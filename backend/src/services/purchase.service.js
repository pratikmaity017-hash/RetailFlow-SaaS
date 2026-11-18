import mongoose from "mongoose";

import Inventory from "../models/inventory.model.js";
import StockMovement from "../models/stock-movement.model.js";
import Purchase from "../models/purchase.model.js";
import PurchaseItem from "../models/purchase-item.model.js";
import Supplier from "../models/supplier.model.js";
import Product from "../models/product.model.js";
import ProductVariant from "../models/product-variant.model.js";
import { createServiceError as createBaseServiceError } from "../utils/service-error.util.js";

function createServiceError(message, statusCode, code) {
  return createBaseServiceError(statusCode, code, message);
}

function isValidQuantity(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0.001 &&
    Number(value.toFixed(3)) === value
  );
}

function isValidPaise(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function calculateLineSubtotal(quantity, unitCostPaise) {
  const subtotal = Math.round(quantity * unitCostPaise);

  if (!Number.isSafeInteger(subtotal)) {
    throw createServiceError(
      "Purchase amount is too large",
      400,
      "INVALID_PURCHASE_AMOUNT",
    );
  }

  return subtotal;
}

export async function createPurchase({
  organizationId,
  userId,
  supplierId,
  items,
  purchaseDate,
  supplierInvoiceNumber,
  notes,
}) {
  if (
    !mongoose.isValidObjectId(organizationId) ||
    !mongoose.isValidObjectId(userId) ||
    !mongoose.isValidObjectId(supplierId)
  ) {
    throw createServiceError(
      "Invalid purchase reference",
      400,
      "INVALID_PURCHASE_REFERENCE",
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw createServiceError(
      "At least one purchase item is required",
      400,
      "PURCHASE_ITEMS_REQUIRED",
    );
  }

  if (items.length > 500) {
    throw createServiceError(
      "A purchase cannot contain more than 500 items",
      400,
      "TOO_MANY_PURCHASE_ITEMS",
    );
  }

  if (
    items.some(
      (item) =>
        item === null || typeof item !== "object" || Array.isArray(item),
    )
  ) {
    throw createServiceError(
      "Each purchase item must be a valid object",
      400,
      "INVALID_PURCHASE_ITEM",
    );
  }

  const session = await mongoose.startSession();

  let createdPurchase;
  let createdItems;

  try {
    await session.withTransaction(async () => {
      const supplier = await Supplier.findOne({
        _id: supplierId,
        organization: organizationId,
        status: "active",
      }).session(session);

      if (!supplier) {
        throw createServiceError(
          "Active supplier not found",
          404,
          "SUPPLIER_NOT_FOUND",
        );
      }

      const purchaseItems = [];
      let subtotalPaise = 0;
      let discountPaise = 0;
      let taxPaise = 0;

      for (const item of items) {
        const {
          productId,
          variantId,
          quantity,
          unitCostPaise,
          discountPaise: itemDiscountPaise = 0,
          taxPaise: itemTaxPaise = 0,
        } = item;

        if (
          !mongoose.isValidObjectId(productId) ||
          !mongoose.isValidObjectId(variantId)
        ) {
          throw createServiceError(
            "Invalid product or variant reference",
            400,
            "INVALID_PURCHASE_ITEM_REFERENCE",
          );
        }

        if (!isValidQuantity(quantity)) {
          throw createServiceError(
            "Invalid purchase quantity",
            400,
            "INVALID_PURCHASE_QUANTITY",
          );
        }

        if (
          !isValidPaise(unitCostPaise) ||
          !isValidPaise(itemDiscountPaise) ||
          !isValidPaise(itemTaxPaise)
        ) {
          throw createServiceError(
            "Invalid purchase item amount",
            400,
            "INVALID_PURCHASE_ITEM_AMOUNT",
          );
        }

        const product = await Product.findOne({
          _id: productId,
          organization: organizationId,
          status: "active",
        }).session(session);

        if (!product) {
          throw createServiceError(
            "Active product not found",
            404,
            "PRODUCT_NOT_FOUND",
          );
        }

        const variant = await ProductVariant.findOne({
          _id: variantId,
          organization: organizationId,
          product: productId,
          status: "active",
        }).session(session);

        if (!variant) {
          throw createServiceError(
            "Active product variant not found",
            404,
            "PRODUCT_VARIANT_NOT_FOUND",
          );
        }

        const lineSubtotalPaise = calculateLineSubtotal(
          quantity,
          unitCostPaise,
        );

        if (itemDiscountPaise > lineSubtotalPaise) {
          throw createServiceError(
            "Item discount cannot exceed its subtotal",
            400,
            "INVALID_PURCHASE_DISCOUNT",
          );
        }

        const lineTotalPaise =
          lineSubtotalPaise - itemDiscountPaise + itemTaxPaise;

        if (!Number.isSafeInteger(lineTotalPaise)) {
          throw createServiceError(
            "Purchase item total is too large",
            400,
            "INVALID_PURCHASE_AMOUNT",
          );
        }

        subtotalPaise += lineSubtotalPaise;
        discountPaise += itemDiscountPaise;
        taxPaise += itemTaxPaise;

        purchaseItems.push({
          organization: organizationId,
          product: product._id,
          variant: variant._id,
          productName: product.name,
          sku: variant.sku,
          attributes: variant.attributes ?? {},
          orderedQuantity: quantity,
          receivedQuantity: 0,
          unitCostPaise,
          lineSubtotalPaise,
          discountPaise: itemDiscountPaise,
          taxPaise: itemTaxPaise,
          lineTotalPaise,
        });
      }

      const totalPaise = subtotalPaise - discountPaise + taxPaise;

      if (
        !Number.isSafeInteger(subtotalPaise) ||
        !Number.isSafeInteger(discountPaise) ||
        !Number.isSafeInteger(taxPaise) ||
        !Number.isSafeInteger(totalPaise)
      ) {
        throw createServiceError(
          "Purchase total is too large",
          400,
          "INVALID_PURCHASE_AMOUNT",
        );
      }

      const purchase = new Purchase({
        organization: organizationId,
        supplier: supplier._id,
        supplierName: supplier.name,
        supplierInvoiceNumber,
        purchaseDate,
        status: "draft",
        subtotalPaise,
        discountPaise,
        taxPaise,
        totalPaise,
        notes,
        createdBy: userId,
      });

      await purchase.save({ session });

      const itemsToCreate = purchaseItems.map((item) => ({
        ...item,
        purchase: purchase._id,
      }));

      const savedItems = await PurchaseItem.insertMany(itemsToCreate, {
        session,
      });

      createdPurchase = purchase;
      createdItems = savedItems;
    });

    return {
      purchase: createdPurchase,
      items: createdItems,
    };
  } finally {
    await session.endSession();
  }
}

export async function orderPurchase({ organizationId, purchaseId, userId }) {
  if (
    !mongoose.isValidObjectId(organizationId) ||
    !mongoose.isValidObjectId(purchaseId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw createServiceError(
      "Invalid purchase reference",
      400,
      "INVALID_PURCHASE_REFERENCE",
    );
  }

  const purchase = await Purchase.findOneAndUpdate(
    {
      _id: purchaseId,
      organization: organizationId,
      status: "draft",
    },
    {
      $set: {
        status: "ordered",
        orderedAt: new Date(),
        updatedBy: userId,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!purchase) {
    const existingPurchase = await Purchase.findOne({
      _id: purchaseId,
      organization: organizationId,
    }).select("_id status");

    if (!existingPurchase) {
      throw createServiceError("Purchase not found", 404, "PURCHASE_NOT_FOUND");
    }

    throw createServiceError(
      "Only draft purchases can be ordered",
      400,
      "PURCHASE_NOT_DRAFT",
    );
  }

  return purchase;
}

export async function receivePurchase({
  organizationId,
  purchaseId,
  userId,
  items,
}) {
  if (
    !mongoose.isValidObjectId(organizationId) ||
    !mongoose.isValidObjectId(purchaseId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw createServiceError(
      "Invalid purchase reference",
      400,
      "INVALID_PURCHASE_REFERENCE",
    );
  }

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 500 ||
    items.some(
      (item) => !item || typeof item !== "object" || Array.isArray(item),
    )
  ) {
    throw createServiceError(
      "Invalid receiving items",
      400,
      "INVALID_RECEIVING_ITEMS",
    );
  }

  const itemIds = items.map((item) => item.purchaseItemId);

  if (
    itemIds.some((id) => !mongoose.isValidObjectId(id)) ||
    new Set(itemIds.map(String)).size !== itemIds.length
  ) {
    throw createServiceError(
      "Invalid or duplicate purchase item reference",
      400,
      "INVALID_RECEIVING_ITEMS",
    );
  }

  for (const item of items) {
    if (!isValidQuantity(item.quantity)) {
      throw createServiceError(
        "Invalid receiving quantity",
        400,
        "INVALID_RECEIVING_QUANTITY",
      );
    }
  }

  const session = await mongoose.startSession();

  let updatedPurchase;
  let updatedItems;

  try {
    let duplicateKeyRetries = 0;

    while (true) {
      try {
        updatedPurchase = undefined;
        updatedItems = undefined;

        await session.withTransaction(async () => {
          // Claim the purchase for this receiving transaction.
          // Concurrent receive/cancel operations must contend on this document.
          const purchase = await Purchase.findOneAndUpdate(
            {
              _id: purchaseId,
              organization: organizationId,
              status: { $in: ["ordered", "partially_received"] },
            },
            {
              $inc: {
                operationRevision: 1,
              },
              $set: {
                updatedBy: userId,
              },
            },
            {
              new: true,
              session,
              runValidators: true,
            },
          );

          if (!purchase) {
            const existingPurchase = await Purchase.findOne({
              _id: purchaseId,
              organization: organizationId,
            })
              .select("_id status")
              .session(session);

            if (!existingPurchase) {
              throw createServiceError(
                "Purchase not found",
                404,
                "PURCHASE_NOT_FOUND",
              );
            }

            throw createServiceError(
              "Purchase cannot receive items in its current status",
              400,
              "PURCHASE_NOT_RECEIVABLE",
            );
          }

          const purchaseItems = await PurchaseItem.find({
            _id: { $in: itemIds },
            purchase: purchase._id,
            organization: organizationId,
          }).session(session);

          if (purchaseItems.length !== items.length) {
            throw createServiceError(
              "One or more purchase items were not found",
              404,
              "PURCHASE_ITEM_NOT_FOUND",
            );
          }

          const purchaseItemsById = new Map(
            purchaseItems.map((item) => [String(item._id), item]),
          );

          for (const receivingItem of items) {
            const purchaseItem = purchaseItemsById.get(
              String(receivingItem.purchaseItemId),
            );

            const remainingQuantity = Number(
              (
                purchaseItem.orderedQuantity - purchaseItem.receivedQuantity
              ).toFixed(3),
            );

            if (receivingItem.quantity > remainingQuantity) {
              throw createServiceError(
                "Receiving quantity exceeds the pending quantity",
                400,
                "RECEIVING_QUANTITY_EXCEEDED",
              );
            }

            purchaseItem.receivedQuantity = Number(
              (purchaseItem.receivedQuantity + receivingItem.quantity).toFixed(
                3,
              ),
            );

            await purchaseItem.save({ session });

            const inventory = await Inventory.findOne({
              organization: organizationId,
              variant: purchaseItem.variant,
            }).session(session);

            let previousQuantity = 0;
            let newQuantity = receivingItem.quantity;

            if (inventory) {
              previousQuantity = inventory.quantity;

              newQuantity = Number(
                (previousQuantity + receivingItem.quantity).toFixed(3),
              );

              if (!Number.isFinite(newQuantity) || newQuantity < 0) {
                throw createServiceError(
                  "Inventory quantity is too large",
                  400,
                  "INVALID_INVENTORY_QUANTITY",
                );
              }

              const inventoryUpdate = await Inventory.updateOne(
                {
                  _id: inventory._id,
                  quantity: previousQuantity,
                },
                {
                  $inc: {
                    quantity: receivingItem.quantity,
                  },
                  $set: {
                    updatedBy: userId,
                  },
                },
                {
                  session,
                  runValidators: true,
                },
              );

              if (inventoryUpdate.modifiedCount !== 1) {
                throw createServiceError(
                  "Inventory changed during receiving. Please retry.",
                  409,
                  "INVENTORY_UPDATE_CONFLICT",
                );
              }
            } else {
              const newInventory = new Inventory({
                organization: organizationId,
                product: purchaseItem.product,
                variant: purchaseItem.variant,
                quantity: newQuantity,
                updatedBy: userId,
              });

              await newInventory.save({ session });
            }

            const stockMovement = new StockMovement({
              organization: organizationId,
              product: purchaseItem.product,
              variant: purchaseItem.variant,
              type: "stock_in",
              quantity: receivingItem.quantity,
              previousQuantity,
              newQuantity,
              reason: `Purchase received: ${purchase._id}`,
              performedBy: userId,
            });

            await stockMovement.save({ session });
          }

          const allPurchaseItems = await PurchaseItem.find({
            purchase: purchase._id,
            organization: organizationId,
          }).session(session);

          if (allPurchaseItems.length === 0) {
            throw createServiceError(
              "Purchase has no items",
              400,
              "PURCHASE_ITEMS_NOT_FOUND",
            );
          }

          const fullyReceived = allPurchaseItems.every(
            (item) =>
              Math.round(item.receivedQuantity * 1000) >=
              Math.round(item.orderedQuantity * 1000),
          );

          const nextStatus = fullyReceived ? "received" : "partially_received";

          purchase.status = nextStatus;
          purchase.receivedAt = fullyReceived ? new Date() : null;
          purchase.updatedBy = userId;

          await purchase.save({ session });

          updatedPurchase = purchase;
          updatedItems = allPurchaseItems;
        });

        break;
      } catch (error) {
        // If another transaction created the same inventory record
        // first, retry the entire transaction against the existing record.
        const isInventoryDuplicate =
          error?.code === 11000 &&
          error?.keyPattern?.organization === 1 &&
          error?.keyPattern?.variant === 1;

        if (isInventoryDuplicate && duplicateKeyRetries < 2) {
          duplicateKeyRetries += 1;
          continue;
        }

        throw error;
      }
    }

    return {
      purchase: updatedPurchase,
      items: updatedItems,
    };
  } finally {
    await session.endSession();
  }
}

export async function cancelPurchase({
  organizationId,
  purchaseId,
  userId,
  cancellationReason,
}) {
  if (
    !mongoose.isValidObjectId(organizationId) ||
    !mongoose.isValidObjectId(purchaseId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw createServiceError(
      "Invalid purchase reference",
      400,
      "INVALID_PURCHASE_REFERENCE",
    );
  }

  if (
    typeof cancellationReason !== "string" ||
    !cancellationReason.trim() ||
    cancellationReason.trim().length > 500
  ) {
    throw createServiceError(
      "A cancellation reason is required (maximum 500 characters)",
      400,
      "INVALID_CANCELLATION_REASON",
    );
  }

  const session = await mongoose.startSession();

  let cancelledPurchase = null;

  try {
    await session.withTransaction(async () => {
      const purchase = await Purchase.findOneAndUpdate(
        {
          _id: purchaseId,
          organization: organizationId,
          status: { $in: ["draft", "ordered"] },
        },
        {
          $inc: {
            operationRevision: 1,
          },
          $set: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledBy: userId,
            cancellationReason: cancellationReason.trim(),
            updatedBy: userId,
          },
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!purchase) {
        const existingPurchase = await Purchase.findOne({
          _id: purchaseId,
          organization: organizationId,
        })
          .select("_id status")
          .session(session)
          .lean();

        if (!existingPurchase) {
          throw createServiceError(
            "Purchase not found",
            404,
            "PURCHASE_NOT_FOUND",
          );
        }

        throw createServiceError(
          "Only draft or ordered purchases can be cancelled",
          400,
          "PURCHASE_NOT_CANCELLABLE",
        );
      }

      cancelledPurchase = purchase;
    });
  } finally {
    await session.endSession();
  }

  return cancelledPurchase;
}
