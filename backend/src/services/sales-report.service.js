import mongoose from "mongoose";

import Organization from "../models/organization.model.js";
import Sale from "../models/sale.model.js";
import SaleItem from "../models/sale-item.model.js";
import Payment from "../models/payment.model.js";
import Return from "../models/return.model.js";
import Refund from "../models/refund.model.js";
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

function getGroupExpression(groupBy, timezone) {
  return {
    $dateTrunc: {
      date: "$createdAt",
      unit: groupBy,
      ...(groupBy === "week" ? { startOfWeek: "monday" } : {}),
      timezone,
    },
  };
}

function addCalendarDays(value, amount) {
  const { year, month, day } = getDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return formatCalendarDate(date);
}

function formatCalendarDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getTrendBucketStart(value, groupBy) {
  const { year, month, day } = getDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (groupBy === "week") {
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
  } else if (groupBy === "month") {
    date.setUTCDate(1);
  }

  return formatCalendarDate(date);
}

function getNextTrendBucket(value, groupBy) {
  if (groupBy === "day") {
    return addCalendarDays(value, 1);
  }

  if (groupBy === "week") {
    return addCalendarDays(value, 7);
  }

  const { year, month } = getDateParts(value);

  return formatCalendarDate(new Date(Date.UTC(year, month, 1)));
}

function createTrendMap(from, to, groupBy, timezone) {
  const trendMap = new Map();

  let bucket = getTrendBucketStart(from, groupBy);

  while (bucket <= to) {
    const period = getUtcBoundary(bucket, timezone);
    const key = period.toISOString();

    trendMap.set(key, {
      period,
      totalSales: 0,
      grossSalesPaise: 0,
      returnAmountPaise: 0,
      netSalesPaise: 0,
      amountPaidPaise: 0,
    });

    bucket = getNextTrendBucket(bucket, groupBy);
  }

  return trendMap;
}

function toSafeInteger(value, fieldName) {
  const amount = Number(value ?? 0);

  if (!Number.isSafeInteger(amount)) {
    throw createServiceError(
      500,
      "SALES_REPORT_AMOUNT_OVERFLOW",
      `Sales report ${fieldName} exceeds the safe integer range`,
    );
  }

  return amount;
}

async function aggregateTotal(model, pipeline) {
  const [result] = await model.aggregate(pipeline);

  return result ?? {};
}

export async function getSalesReport({
  organizationId,
  from,
  to,
  groupBy = "day",
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
  }).select("settings.timezone");

  if (!organization) {
    throw createServiceError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Organization not found",
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

  const saleMatch = {
    organization: organizationObjectId,
    status: "completed",
    createdAt: dateRange,
  };

  const returnMatch = {
    organization: organizationObjectId,
    status: { $in: ["approved", "completed"] },
    createdAt: dateRange,
  };

  const refundMatch = {
    organization: organizationObjectId,
    status: "processed",
    processedAt: dateRange,
  };

  const paymentMatch = {
    organization: organizationObjectId,
    createdAt: dateRange,
  };

  const [
    salesSummary,
    paymentSummary,
    paymentMethods,
    returnSummary,
    refundSummary,
    salesTrends,
    returnTrends,
    topProducts,
  ] = await Promise.all([
    aggregateTotal(Sale, [
      { $match: saleMatch },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          grossSalesPaise: { $sum: "$totalPaise" },
          amountPaidPaise: { $sum: "$amountPaidPaise" },
          outstandingPaise: { $sum: "$balanceDuePaise" },
        },
      },
    ]),

    aggregateTotal(Payment, [
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          collectedPaise: { $sum: "$amountPaise" },
        },
      },
    ]),

    Payment.aggregate([
      { $match: paymentMatch },
      {
        $group: {
          _id: "$method",
          totalPayments: { $sum: 1 },
          amountPaise: { $sum: "$amountPaise" },
        },
      },
      { $sort: { amountPaise: -1 } },
    ]),

    aggregateTotal(Return, [
      { $match: returnMatch },
      {
        $group: {
          _id: null,
          totalReturns: { $sum: 1 },
          returnedQuantity: { $sum: "$totalQuantity" },
          returnAmountPaise: { $sum: "$totalRefundPaise" },
          pendingRefundPaise: {
            $sum: {
              $cond: [
                { $eq: ["$refundStatus", "pending"] },
                "$totalRefundPaise",
                0,
              ],
            },
          },
        },
      },
    ]),

    aggregateTotal(Refund, [
      { $match: refundMatch },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: 1 },
          processedRefundPaise: { $sum: "$amountPaise" },
        },
      },
    ]),

    Sale.aggregate([
      { $match: saleMatch },
      {
        $group: {
          _id: getGroupExpression(groupBy, timezone),
          totalSales: { $sum: 1 },
          grossSalesPaise: { $sum: "$totalPaise" },
          amountPaidPaise: { $sum: "$amountPaidPaise" },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Return.aggregate([
      { $match: returnMatch },
      {
        $group: {
          _id: getGroupExpression(groupBy, timezone),
          totalReturns: { $sum: 1 },
          returnAmountPaise: { $sum: "$totalRefundPaise" },
        },
      },
      { $sort: { _id: 1 } },
    ]),

    Sale.aggregate([
      {
        $match: saleMatch,
      },
      {
        $lookup: {
          from: SaleItem.collection.name,
          let: {
            saleId: "$_id",
            organizationId: organizationObjectId,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$sale", "$$saleId"] },
                    { $eq: ["$organization", "$$organizationId"] },
                  ],
                },
              },
            },
          ],
          as: "saleItems",
        },
      },
      { $unwind: "$saleItems" },
      {
        $lookup: {
          from: ReturnItem.collection.name,
          let: {
            saleItemId: "$saleItems._id",
            organizationId: organizationObjectId,
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$saleItem", "$$saleItemId"] },
                    { $eq: ["$organization", "$$organizationId"] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: Return.collection.name,
                localField: "return",
                foreignField: "_id",
                as: "return",
              },
            },
            { $unwind: "$return" },
            {
              $match: {
                "return.organization": organizationObjectId,
                "return.status": {
                  $in: ["approved", "completed"],
                },
              },
            },
            {
              $group: {
                _id: null,
                returnedQuantity: { $sum: "$quantity" },
                returnedAmountPaise: { $sum: "$refundAmountPaise" },
              },
            },
          ],
          as: "returnSummary",
        },
      },
      {
        $addFields: {
          returnedQuantity: {
            $ifNull: [
              { $arrayElemAt: ["$returnSummary.returnedQuantity", 0] },
              0,
            ],
          },
          returnedAmountPaise: {
            $ifNull: [
              { $arrayElemAt: ["$returnSummary.returnedAmountPaise", 0] },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            product: "$saleItems.product",
            variant: "$saleItems.variant",
            sku: "$saleItems.sku",
          },
          productName: { $first: "$saleItems.productName" },
          grossQuantitySold: { $sum: "$saleItems.quantity" },
          returnedQuantity: { $sum: "$returnedQuantity" },
          quantitySold: {
            $sum: {
              $subtract: ["$saleItems.quantity", "$returnedQuantity"],
            },
          },
          grossSalesPaise: { $sum: "$saleItems.lineTotalPaise" },
          returnedAmountPaise: { $sum: "$returnedAmountPaise" },
        },
      },
      {
        $addFields: {
          netSalesPaise: {
            $subtract: ["$grossSalesPaise", "$returnedAmountPaise"],
          },
        },
      },
      { $sort: { quantitySold: -1, netSalesPaise: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const grossSalesPaise = toSafeInteger(
    salesSummary.grossSalesPaise,
    "gross sales",
  );

  const returnAmountPaise = toSafeInteger(
    returnSummary.returnAmountPaise,
    "return amount",
  );

  const netSalesPaise = grossSalesPaise - returnAmountPaise;

  if (!Number.isSafeInteger(netSalesPaise)) {
    throw createServiceError(
      500,
      "SALES_REPORT_AMOUNT_OVERFLOW",
      "Net sales exceeds the safe integer range",
    );
  }

  const trendMap = createTrendMap(from, to, groupBy, timezone);

  for (const item of salesTrends) {
    const key = item._id.toISOString();
    const existing = trendMap.get(key);

    if (!existing) {
      continue;
    }

    existing.totalSales = item.totalSales;
    existing.grossSalesPaise = item.grossSalesPaise;
    existing.amountPaidPaise = item.amountPaidPaise;

    existing.netSalesPaise =
      existing.grossSalesPaise - existing.returnAmountPaise;
  }

  for (const item of returnTrends) {
    const key = item._id.toISOString();
    const existing = trendMap.get(key);

    if (!existing) {
      continue;
    }

    existing.returnAmountPaise = item.returnAmountPaise;

    existing.netSalesPaise =
      existing.grossSalesPaise - existing.returnAmountPaise;
  }

  return {
    filters: {
      from,
      to,
      groupBy,
      timezone,
    },

    summary: {
      totalSales: salesSummary.totalSales ?? 0,
      grossSalesPaise,
      returnAmountPaise,
      netSalesPaise,
      amountPaidPaise: toSafeInteger(
        salesSummary.amountPaidPaise,
        "sales amount paid",
      ),
      outstandingPaise: toSafeInteger(
        salesSummary.outstandingPaise,
        "outstanding balance",
      ),
      collectedPaise: toSafeInteger(
        paymentSummary.collectedPaise,
        "payment collection",
      ),
      totalPayments: paymentSummary.totalPayments ?? 0,
      totalReturns: returnSummary.totalReturns ?? 0,
      returnedQuantity: returnSummary.returnedQuantity ?? 0,
      pendingRefundPaise: toSafeInteger(
        returnSummary.pendingRefundPaise,
        "pending refunds",
      ),
      processedRefundPaise: toSafeInteger(
        refundSummary.processedRefundPaise,
        "processed refunds",
      ),
      totalRefunds: refundSummary.totalRefunds ?? 0,
    },

    paymentMethods: paymentMethods.map((item) => ({
      method: item._id,
      totalPayments: item.totalPayments,
      amountPaise: toSafeInteger(item.amountPaise, "payment method total"),
    })),

    trends: [...trendMap.values()]
      .sort((a, b) => a.period - b.period)
      .map((item) => ({
        ...item,
        grossSalesPaise: toSafeInteger(
          item.grossSalesPaise,
          "trend gross sales",
        ),
        returnAmountPaise: toSafeInteger(
          item.returnAmountPaise,
          "trend return amount",
        ),
        netSalesPaise: toSafeInteger(item.netSalesPaise, "trend net sales"),
        amountPaidPaise: toSafeInteger(
          item.amountPaidPaise,
          "trend amount paid",
        ),
      })),

    topProducts: topProducts.map((item) => ({
      productId: item._id.product,
      variantId: item._id.variant,
      productName: item.productName,
      sku: item._id.sku,
      grossQuantitySold: item.grossQuantitySold,
      returnedQuantity: item.returnedQuantity,
      quantitySold: item.quantitySold,
      grossSalesPaise: toSafeInteger(
        item.grossSalesPaise,
        "product gross sales",
      ),
      returnedAmountPaise: toSafeInteger(
        item.returnedAmountPaise,
        "product returned amount",
      ),
      netSalesPaise: toSafeInteger(item.netSalesPaise, "product net sales"),
    })),
  };
}
