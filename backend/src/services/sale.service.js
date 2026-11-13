import mongoose from "mongoose";

import Sale from "../models/sale.model.js";
import SaleItem from "../models/sale-item.model.js";
import Customer from "../models/customer.model.js";
import Product from "../models/product.model.js";
import ProductVariant from "../models/product-variant.model.js";
import Inventory from "../models/inventory.model.js";
import StockMovement from "../models/stock-movement.model.js";

import { createServiceError } from "../utils/service-error.util.js";

function normalizeQuantity(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function convertToPaise(price) {
  if (!Number.isFinite(price) || price < 0) {
    throw createServiceError(
      400,
      "INVALID_PRODUCT_PRICE",
      "A product has an invalid selling price",
    );
  }

  const amount = Math.round(price * 100);

  if (!Number.isSafeInteger(amount)) {
    throw createServiceError(
      400,
      "INVALID_PRODUCT_PRICE",
      "Product price is too large",
    );
  }

  return amount;
}

function ensureSafeTotal(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw createServiceError(
      400,
      "SALE_AMOUNT_TOO_LARGE",
      "The sale amount exceeds the supported limit",
    );
  }

  return amount;
}

export async function createSale({ organizationId, userId, saleData }) {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const { customerId, items, notes = "" } = saleData;

      // 1. Verify the customer, if this is not a walk-in sale.
      let customer = null;

      if (customerId) {
        customer = await Customer.findOne({
          _id: customerId,
          organization: organizationId,
          status: "active",
        })
          .select("_id")
          .session(session);

        if (!customer) {
          throw createServiceError(
            404,
            "CUSTOMER_NOT_FOUND",
            "Active customer not found",
          );
        }
      }

      // 2. Fetch all requested active variants belonging to this organization.
      const variantIds = items.map((item) => item.variantId);

      const variants = await ProductVariant.find({
        _id: { $in: variantIds },
        organization: organizationId,
        status: "active",
      }).session(session);

      if (variants.length !== items.length) {
        throw createServiceError(
          404,
          "VARIANT_NOT_FOUND",
          "One or more active product variants were not found",
        );
      }

      const variantMap = new Map(
        variants.map((variant) => [variant._id.toString(), variant]),
      );

      // 3. Fetch and verify the associated active products.
      const productIds = [
        ...new Set(variants.map((variant) => variant.product.toString())),
      ];

      const products = await Product.find({
        _id: { $in: productIds },
        organization: organizationId,
        status: "active",
      }).session(session);

      if (products.length !== productIds.length) {
        throw createServiceError(
          404,
          "PRODUCT_NOT_FOUND",
          "One or more active products were not found",
        );
      }

      const productMap = new Map(
        products.map((product) => [product._id.toString(), product]),
      );

      // 4. Calculate sale items using trusted database prices.
      const saleItems = [];
      let subtotalPaise = 0;

      for (const requestedItem of items) {
        const variant = variantMap.get(requestedItem.variantId);
        const product = productMap.get(variant.product.toString());

        if (!product) {
          throw createServiceError(
            404,
            "PRODUCT_NOT_FOUND",
            "The product associated with a variant was not found",
          );
        }

        const quantity = normalizeQuantity(requestedItem.quantity);

        const unitPricePaise = convertToPaise(variant.sellingPrice);
        const unitCostPaise = convertToPaise(variant.costPrice);

        const lineSubtotalPaise = ensureSafeTotal(
          Math.round(unitPricePaise * quantity),
        );

        subtotalPaise = ensureSafeTotal(subtotalPaise + lineSubtotalPaise);

        saleItems.push({
          organization: organizationId,
          product: product._id,
          variant: variant._id,

          productName: product.name,
          sku: variant.sku,
          attributes: variant.attributes ?? {},

          quantity,
          unitPricePaise,
          unitCostPaise,
          lineSubtotalPaise,

          discountPaise: 0,
          taxPaise: 0,
          lineTotalPaise: lineSubtotalPaise,
        });
      }

      // 5. Create the sale record.
      const totalPaise = subtotalPaise;

      const [sale] = await Sale.create(
        [
          {
            organization: organizationId,
            customer: customer?._id ?? null,

            status: "completed",
            paymentStatus: totalPaise === 0 ? "paid" : "unpaid",

            currency: "INR",

            subtotalPaise,
            discountPaise: 0,
            taxPaise: 0,
            totalPaise,

            amountPaidPaise: 0,
            balanceDuePaise: totalPaise,

            notes,
            createdBy: userId,
          },
        ],
        { session },
      );

      // 6. Deduct inventory and record stock movements.
      for (const saleItem of saleItems) {
        const inventory = await Inventory.findOne({
          organization: organizationId,
          product: saleItem.product,
          variant: saleItem.variant,
        }).session(session);

        const previousQuantity = inventory?.quantity ?? 0;

        if (previousQuantity < saleItem.quantity) {
          throw createServiceError(
            400,
            "INSUFFICIENT_STOCK",
            `Insufficient stock for ${saleItem.sku}`,
          );
        }

        const newQuantity = normalizeQuantity(
          previousQuantity - saleItem.quantity,
        );

        if (!inventory) {
          throw createServiceError(
            400,
            "INSUFFICIENT_STOCK",
            `Insufficient stock for ${saleItem.sku}`,
          );
        }

        // Conditional update prevents deducting more stock than is available.
        const updateResult = await Inventory.updateOne(
          {
            _id: inventory._id,
            organization: organizationId,
            quantity: { $gte: saleItem.quantity },
          },
          {
            $set: {
              quantity: newQuantity,
              updatedBy: userId,
            },
          },
          { session },
        );

        if (updateResult.modifiedCount !== 1) {
          throw createServiceError(
            400,
            "INSUFFICIENT_STOCK",
            `Insufficient stock for ${saleItem.sku}`,
          );
        }

        await StockMovement.create(
          [
            {
              organization: organizationId,
              product: saleItem.product,
              variant: saleItem.variant,

              type: "stock_out",
              quantity: saleItem.quantity,

              previousQuantity,
              newQuantity,

              reason: `Sale ${sale._id}`,
              performedBy: userId,
            },
          ],
          { session },
        );

        saleItem.sale = sale._id;
      }

      // 7. Save all sale item snapshots.
      const createdItems = await SaleItem.insertMany(saleItems, {
        session,
      });

      result = {
        sale,
        items: createdItems,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

function normalizePagination(value, fallback, maximum = Infinity) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

export async function getSales({
  organizationId,
  status,
  paymentStatus,
  customerId,
  page,
  limit,
}) {
  const filter = {
    organization: organizationId,
  };

  if (status !== undefined) {
    if (!["completed", "cancelled"].includes(status)) {
      throw createServiceError(
        400,
        "INVALID_SALE_STATUS",
        "Invalid sale status filter",
      );
    }

    filter.status = status;
  }

  if (paymentStatus !== undefined) {
    if (!["unpaid", "partially_paid", "paid"].includes(paymentStatus)) {
      throw createServiceError(
        400,
        "INVALID_PAYMENT_STATUS",
        "Invalid payment status filter",
      );
    }

    filter.paymentStatus = paymentStatus;
  }

  if (customerId !== undefined) {
    if (!mongoose.isValidObjectId(customerId)) {
      throw createServiceError(
        400,
        "INVALID_CUSTOMER_ID",
        "Invalid customer ID",
      );
    }

    filter.customer = customerId;
  }

  const currentPage = normalizePagination(page, 1);
  const pageSize = normalizePagination(limit, 20, 100);
  const skip = (currentPage - 1) * pageSize;

  const [sales, totalSales] = await Promise.all([
    Sale.find(filter)
      .populate("customer", "name phone")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    Sale.countDocuments(filter),
  ]);

  return {
    sales,
    pagination: {
      currentPage,
      pageSize,
      totalSales,
      totalPages: Math.ceil(totalSales / pageSize),
      hasNextPage: skip + sales.length < totalSales,
      hasPreviousPage: currentPage > 1,
    },
  };
}

export async function getSaleById({ organizationId, saleId }) {
  if (!mongoose.isValidObjectId(saleId)) {
    throw createServiceError(400, "INVALID_SALE_ID", "Invalid sale ID");
  }

  const sale = await Sale.findOne({
    _id: saleId,
    organization: organizationId,
  })
    .populate("customer", "name phone email")
    .populate("createdBy", "name")
    .populate("cancelledBy", "name");

  if (!sale) {
    throw createServiceError(404, "SALE_NOT_FOUND", "Sale not found");
  }

  const items = await SaleItem.find({
    organization: organizationId,
    sale: sale._id,
  }).lean();

  return {
    sale,
    items,
  };
}
