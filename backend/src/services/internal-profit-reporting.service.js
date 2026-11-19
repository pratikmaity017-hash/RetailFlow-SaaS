import mongoose from "mongoose";

import Organization from "../models/organization.model.js";
import Sale from "../models/sale.model.js";
import SaleItem from "../models/sale-item.model.js";
import Return from "../models/return.model.js";
import ReturnItem from "../models/return-item.model.js";

import { createServiceError } from "../utils/service-error.util.js";

function getDateParts(value) {
  const [year, month, day] = value.split("-").map(Number);

  return { year, month, day };
}

function getNextDate(value) {
  const { year, month, day } = getDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day + 1));

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getTimezoneOffset(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  const localTimeAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );

  return localTimeAsUtc - date.getTime();
}

function getUtcBoundary(dateString, timezone) {
  const { year, month, day } = getDateParts(dateString);
  const utcGuess = new Date(Date.UTC(year, month - 1, day));

  const firstOffset = getTimezoneOffset(utcGuess, timezone);
  let boundary = new Date(utcGuess.getTime() - firstOffset);

  const secondOffset = getTimezoneOffset(boundary, timezone);

  if (firstOffset !== secondOffset) {
    boundary = new Date(utcGuess.getTime() - secondOffset);
  }

  return boundary;
}

function createDateRange(from, to, timezone) {
  return {
    $gte: getUtcBoundary(from, timezone),
    $lt: getUtcBoundary(getNextDate(to), timezone),
  };
}

function toSafeInteger(value, fieldName) {
  const amount = Number(value ?? 0);

  if (!Number.isSafeInteger(amount)) {
    throw createServiceError(
      500,
      "PROFIT_REPORT_AMOUNT_OVERFLOW",
      `Profit reporting ${fieldName} exceeds the safe integer range`,
    );
  }

  return amount;
}

function getSalesPipeline(organizationId, dateRange, timezone) {
  return [
    {
      $match: {
        organization: organizationId,
        status: "completed",
        createdAt: dateRange,
      },
    },
    {
      $lookup: {
        from: SaleItem.collection.name,
        let: { saleId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$sale", "$$saleId"] },
                  { $eq: ["$organization", organizationId] },
                ],
              },
            },
          },
        ],
        as: "items",
      },
    },
    { $unwind: "$items" },
    {
      $addFields: {
        period: {
          $dateTrunc: {
            date: "$createdAt",
            unit: "day",
            timezone,
          },
        },
        cogsPaise: {
          $round: [
            { $multiply: ["$items.unitCostPaise", "$items.quantity"] },
            0,
          ],
        },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              grossSalesPaise: { $sum: "$items.lineTotalPaise" },
              grossCogsPaise: { $sum: "$cogsPaise" },
              quantitySold: { $sum: "$items.quantity" },
              saleItemCount: { $sum: 1 },
            },
          },
        ],
        trends: [
          {
            $group: {
              _id: "$period",
              grossSalesPaise: { $sum: "$items.lineTotalPaise" },
              grossCogsPaise: { $sum: "$cogsPaise" },
              quantitySold: { $sum: "$items.quantity" },
            },
          },
          { $sort: { _id: 1 } },
        ],
        products: [
          {
            $group: {
              _id: {
                productId: "$items.product",
                variantId: "$items.variant",
                sku: "$items.sku",
              },
              productName: { $first: "$items.productName" },
              quantitySold: { $sum: "$items.quantity" },
              grossSalesPaise: { $sum: "$items.lineTotalPaise" },
              grossCogsPaise: { $sum: "$cogsPaise" },
            },
          },
          { $sort: { grossSalesPaise: -1 } },
        ],
      },
    },
  ];
}

function getReturnsPipeline(organizationId, dateRange, timezone) {
  return [
    {
      $match: {
        organization: organizationId,
        status: { $in: ["approved", "completed"] },
        processedAt: dateRange,
      },
    },
    {
      $lookup: {
        from: ReturnItem.collection.name,
        let: { returnId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$return", "$$returnId"] },
                  { $eq: ["$organization", organizationId] },
                ],
              },
            },
          },
        ],
        as: "items",
      },
    },
    { $unwind: "$items" },
    {
      $lookup: {
        from: SaleItem.collection.name,
        let: { saleItemId: "$items.saleItem" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$saleItemId"] },
                  { $eq: ["$organization", organizationId] },
                ],
              },
            },
          },
          {
            $project: {
              unitCostPaise: 1,
            },
          },
        ],
        as: "originalSaleItem",
      },
    },
    { $unwind: "$originalSaleItem" },
    {
      $addFields: {
        period: {
          $dateTrunc: {
            date: "$processedAt",
            unit: "day",
            timezone,
          },
        },
        returnedCogsPaise: {
          $cond: [
            "$items.restock",
            {
              $round: [
                {
                  $multiply: [
                    "$originalSaleItem.unitCostPaise",
                    "$items.quantity",
                  ],
                },
                0,
              ],
            },
            0,
          ],
        },
      },
    },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              returnAmountPaise: { $sum: "$items.refundAmountPaise" },
              returnedCogsPaise: { $sum: "$returnedCogsPaise" },
              returnedQuantity: { $sum: "$items.quantity" },
              returnItemCount: { $sum: 1 },
            },
          },
        ],
        trends: [
          {
            $group: {
              _id: "$period",
              returnAmountPaise: { $sum: "$items.refundAmountPaise" },
              returnedCogsPaise: { $sum: "$returnedCogsPaise" },
              returnedQuantity: { $sum: "$items.quantity" },
            },
          },
          { $sort: { _id: 1 } },
        ],
        products: [
          {
            $group: {
              _id: {
                productId: "$items.product",
                variantId: "$items.variant",
                sku: "$items.sku",
              },
              productName: { $first: "$items.productName" },
              returnedQuantity: { $sum: "$items.quantity" },
              returnAmountPaise: { $sum: "$items.refundAmountPaise" },
              returnedCogsPaise: { $sum: "$returnedCogsPaise" },
            },
          },
          { $sort: { returnAmountPaise: -1 } },
        ],
      },
    },
  ];
}

function normalizeSalesResult(result = {}) {
  const summary = result.summary?.[0] ?? {};

  return {
    summary: {
      grossSalesPaise: toSafeInteger(summary.grossSalesPaise, "gross sales"),
      grossCogsPaise: toSafeInteger(
        summary.grossCogsPaise,
        "gross cost of goods sold",
      ),
      quantitySold: summary.quantitySold ?? 0,
      saleItemCount: summary.saleItemCount ?? 0,
    },

    trends: (result.trends ?? []).map((item) => ({
      date: item._id,
      grossSalesPaise: toSafeInteger(item.grossSalesPaise, "daily gross sales"),
      grossCogsPaise: toSafeInteger(item.grossCogsPaise, "daily gross cost"),
      quantitySold: item.quantitySold ?? 0,
    })),

    products: (result.products ?? []).map((item) => ({
      productId: item._id.productId,
      variantId: item._id.variantId,
      productName: item.productName,
      sku: item._id.sku,
      quantitySold: item.quantitySold ?? 0,
      grossSalesPaise: toSafeInteger(
        item.grossSalesPaise,
        "product gross sales",
      ),
      grossCogsPaise: toSafeInteger(item.grossCogsPaise, "product gross cost"),
    })),
  };
}

function normalizeReturnsResult(result = {}) {
  const summary = result.summary?.[0] ?? {};

  return {
    summary: {
      returnAmountPaise: toSafeInteger(
        summary.returnAmountPaise,
        "approved return amount",
      ),
      returnedCogsPaise: toSafeInteger(
        summary.returnedCogsPaise,
        "returned cost of goods",
      ),
      returnedQuantity: summary.returnedQuantity ?? 0,
      returnItemCount: summary.returnItemCount ?? 0,
    },

    trends: (result.trends ?? []).map((item) => ({
      date: item._id,
      returnAmountPaise: toSafeInteger(
        item.returnAmountPaise,
        "daily return amount",
      ),
      returnedCogsPaise: toSafeInteger(
        item.returnedCogsPaise,
        "daily returned cost",
      ),
      returnedQuantity: item.returnedQuantity ?? 0,
    })),

    products: (result.products ?? []).map((item) => ({
      productId: item._id.productId,
      variantId: item._id.variantId,
      productName: item.productName,
      sku: item._id.sku,
      returnedQuantity: item.returnedQuantity ?? 0,
      returnAmountPaise: toSafeInteger(
        item.returnAmountPaise,
        "product return amount",
      ),
      returnedCogsPaise: toSafeInteger(
        item.returnedCogsPaise,
        "product returned cost",
      ),
    })),
  };
}

export async function getInternalProfitReportingData({
  organizationId,
  from,
  to,
}) {
  if (!mongoose.isValidObjectId(organizationId)) {
    throw createServiceError(
      400,
      "INVALID_ORGANIZATION_ID",
      "Invalid organization ID",
    );
  }

  const organization = await Organization.findOne({
    _id: organizationId,
    status: "active",
  }).select("_id settings.timezone");

  if (!organization) {
    throw createServiceError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Organization not found or unavailable",
    );
  }

  const timezone = organization.settings?.timezone || "Asia/Kolkata";

  let dateRange;

  try {
    dateRange = createDateRange(from, to, timezone);
  } catch {
    throw createServiceError(
      400,
      "INVALID_REPORT_TIMEZONE",
      "Organization timezone is invalid",
    );
  }

  const organizationObjectId = new mongoose.Types.ObjectId(organizationId);

  const [salesResult, returnsResult] = await Promise.all([
    Sale.aggregate(getSalesPipeline(organizationObjectId, dateRange, timezone)),
    Return.aggregate(
      getReturnsPipeline(organizationObjectId, dateRange, timezone),
    ),
  ]);

  return {
    filters: {
      from,
      to,
      timezone,
      currency: "INR",
      monetaryUnit: "paise",
    },
    sales: normalizeSalesResult(salesResult[0]),
    returns: normalizeReturnsResult(returnsResult[0]),
  };
}
