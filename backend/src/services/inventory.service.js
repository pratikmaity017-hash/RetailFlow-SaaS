import mongoose from "mongoose";
import Inventory from "../models/inventory.model.js";
import StockMovement from "../models/stock-movement.model.js";
import Product from "../models/product.model.js";
import ProductVariant from "../models/product-variant.model.js";
import { createServiceError } from "../utils/service-error.util.js";

export async function adjustStock({
  organizationId,
  productId,
  variantId,
  userId,
  adjustmentData,
}) {
  // 1. Verify the product belongs to this organization.
  const product = await Product.findOne({
    _id: productId,
    organization: organizationId,
    status: "active",
  }).select("_id");

  if (!product) {
    throw createServiceError(
      404,
      "PRODUCT_NOT_FOUND",
      "Active product not found",
    );
  }

  // 2. Verify the variant belongs to this product and organization.
  const variant = await ProductVariant.findOne({
    _id: variantId,
    organization: organizationId,
    product: product._id,
    status: "active",
  }).select("_id");

  if (!variant) {
    throw createServiceError(
      404,
      "VARIANT_NOT_FOUND",
      "Active product variant not found",
    );
  }

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 3. Find the current inventory record.
      let inventory = await Inventory.findOne({
        organization: organizationId,
        variant: variant._id,
      }).session(session);

      const previousQuantity = inventory?.quantity ?? 0;

      // 4. Calculate the new stock quantity.
      let newQuantity;

      const { type, quantity, reason } = adjustmentData;

      if (type === "stock_in") {
        newQuantity = previousQuantity + quantity;
      } else if (type === "stock_out") {
        if (quantity > previousQuantity) {
          throw createServiceError(
            400,
            "INSUFFICIENT_STOCK",
            "Stock quantity is insufficient",
          );
        }

        newQuantity = previousQuantity - quantity;
      } else {
        newQuantity = quantity;
      }

      if (newQuantity === previousQuantity) {
        throw createServiceError(
          400,
          "NO_STOCK_CHANGE",
          "The requested operation does not change stock",
        );
      }

      // 5. Create inventory if it does not exist.
      if (!inventory) {
        inventory = new Inventory({
          organization: organizationId,
          product: product._id,
          variant: variant._id,
          quantity: previousQuantity,
          updatedBy: userId,
        });
      }

      inventory.quantity = newQuantity;
      inventory.updatedBy = userId;

      await inventory.save({ session });

      // 6. Record the stock movement.
      const movement = await StockMovement.create(
        [
          {
            organization: organizationId,
            product: product._id,
            variant: variant._id,
            type,
            quantity: Math.abs(newQuantity - previousQuantity),
            previousQuantity,
            newQuantity,
            reason,
            performedBy: userId,
          },
        ],
        { session },
      );

      result = {
        inventory,
        movement: movement[0],
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

export async function getInventory({ organizationId, productId, variantId }) {
  // 1. Verify that the product belongs to this organization.
  const product = await Product.findOne({
    _id: productId,
    organization: organizationId,
  }).select("_id");

  if (!product) {
    throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  // 2. Verify that the variant belongs to this product.
  const variant = await ProductVariant.findOne({
    _id: variantId,
    organization: organizationId,
    product: product._id,
  }).select("_id sku barcode");

  if (!variant) {
    throw createServiceError(
      404,
      "VARIANT_NOT_FOUND",
      "Product variant not found",
    );
  }

  // 3. Find the inventory record.
  const inventory = await Inventory.findOne({
    organization: organizationId,
    product: product._id,
    variant: variant._id,
  });

  // 4. Return zero-stock information if no record exists.
  const quantity = inventory?.quantity ?? 0;
  const lowStockThreshold = inventory?.lowStockThreshold ?? 5;

  return {
    inventory,
    variant,
    quantity,
    lowStockThreshold,
    isLowStock: quantity <= lowStockThreshold,
  };
}

export async function getStockMovements({
  organizationId,
  productId,
  variantId,
  page = 1,
  limit = 20,
}) {
  // Verify that the product belongs to this organization.
  const product = await Product.findOne({
    _id: productId,
    organization: organizationId,
  }).select("_id");

  if (!product) {
    throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  // Verify that the variant belongs to this product.
  const variant = await ProductVariant.findOne({
    _id: variantId,
    organization: organizationId,
    product: product._id,
  }).select("_id");

  if (!variant) {
    throw createServiceError(
      404,
      "VARIANT_NOT_FOUND",
      "Product variant not found",
    );
  }

  // Normalize pagination values.
  const currentPage = Number.isInteger(Number(page))
    ? Math.max(1, Number(page))
    : 1;

  const pageSize = Number.isInteger(Number(limit))
    ? Math.min(100, Math.max(1, Number(limit)))
    : 20;

  const skip = (currentPage - 1) * pageSize;

  const filter = {
    organization: organizationId,
    product: product._id,
    variant: variant._id,
  };

  const [movements, totalMovements] = await Promise.all([
    StockMovement.find(filter)
      .populate("performedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    StockMovement.countDocuments(filter),
  ]);

  return {
    movements,
    pagination: {
      currentPage,
      pageSize,
      totalMovements,
      totalPages: Math.ceil(totalMovements / pageSize),
    },
  };
}

export async function getLowStockInventory({
  organizationId,
  page = 1,
  limit = 20,
}) {
  // Normalize pagination.
  const currentPage = Number.isInteger(Number(page))
    ? Math.max(1, Number(page))
    : 1;

  const pageSize = Number.isInteger(Number(limit))
    ? Math.min(100, Math.max(1, Number(limit)))
    : 20;

  const skip = (currentPage - 1) * pageSize;

  const organizationObjectId = new mongoose.Types.ObjectId(organizationId);

  const result = await Inventory.aggregate([
    // Find inventory records at or below their threshold.
    {
      $match: {
        organization: organizationObjectId,
        $expr: {
          $lte: ["$quantity", "$lowStockThreshold"],
        },
      },
    },

    // Get product information.
    {
      $lookup: {
        from: Product.collection.name,
        localField: "product",
        foreignField: "_id",
        as: "productDetails",
      },
    },
    { $unwind: "$productDetails" },

    // Exclude inactive products.
    {
      $match: {
        "productDetails.status": "active",
      },
    },

    // Get variant information.
    {
      $lookup: {
        from: ProductVariant.collection.name,
        localField: "variant",
        foreignField: "_id",
        as: "variantDetails",
      },
    },
    { $unwind: "$variantDetails" },

    // Exclude inactive variants.
    {
      $match: {
        "variantDetails.status": "active",
      },
    },

    // Latest inventory updates first.
    {
      $sort: {
        updatedAt: -1,
      },
    },

    // Calculate results and pagination together.
    {
      $facet: {
        inventory: [
          { $skip: skip },
          { $limit: pageSize },
          {
            $project: {
              organization: 1,
              product: 1,
              variant: 1,
              quantity: 1,
              lowStockThreshold: 1,
              updatedAt: 1,
              productDetails: {
                _id: 1,
                name: 1,
                category: 1,
                brand: 1,
              },
              variantDetails: {
                _id: 1,
                sku: 1,
                barcode: 1,
                attributes: 1,
              },
            },
          },
        ],
        metadata: [{ $count: "totalItems" }],
      },
    },
  ]);

  const inventory = result[0]?.inventory ?? [];
  const totalItems = result[0]?.metadata[0]?.totalItems ?? 0;

  return {
    inventory,
    pagination: {
      currentPage,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
    },
  };
}
