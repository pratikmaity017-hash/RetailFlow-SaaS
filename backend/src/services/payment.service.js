import mongoose from "mongoose";

import Sale from "../models/sale.model.js";
import Payment from "../models/payment.model.js";

function createServiceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function convertToPaise(amount) {
  const amountPaise = Math.round(amount * 100);

  if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
    throw createServiceError(
      400,
      "INVALID_PAYMENT_AMOUNT",
      "Invalid payment amount",
    );
  }

  return amountPaise;
}

export async function createPayment({
  organizationId,
  saleId,
  userId,
  paymentData,
}) {
  if (!mongoose.isValidObjectId(saleId)) {
    throw createServiceError(400, "INVALID_SALE_ID", "Invalid sale ID");
  }

  const amountPaise = convertToPaise(paymentData.amount);

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const sale = await Sale.findOne({
        _id: saleId,
        organization: organizationId,
      }).session(session);

      if (!sale) {
        throw createServiceError(404, "SALE_NOT_FOUND", "Sale not found");
      }

      if (sale.status !== "completed") {
        throw createServiceError(
          400,
          "SALE_NOT_PAYABLE",
          "Payments cannot be recorded for a cancelled sale",
        );
      }

      if (sale.balanceDuePaise <= 0) {
        throw createServiceError(
          400,
          "SALE_ALREADY_PAID",
          "This sale has no outstanding balance",
        );
      }

      if (amountPaise > sale.balanceDuePaise) {
        throw createServiceError(
          400,
          "PAYMENT_EXCEEDS_BALANCE",
          "Payment amount cannot exceed the outstanding balance",
        );
      }

      const newAmountPaidPaise = sale.amountPaidPaise + amountPaise;

      const newBalanceDuePaise = sale.balanceDuePaise - amountPaise;

      let newPaymentStatus = "partially_paid";

      if (newBalanceDuePaise === 0) {
        newPaymentStatus = "paid";
      }

      // Atomically update the sale balance.
      const updateResult = await Sale.updateOne(
        {
          _id: sale._id,
          organization: organizationId,
          status: "completed",
          balanceDuePaise: { $gte: amountPaise },
        },
        {
          $inc: {
            amountPaidPaise: amountPaise,
            balanceDuePaise: -amountPaise,
          },
          $set: {
            paymentStatus: newPaymentStatus,
          },
        },
        { session },
      );

      if (updateResult.matchedCount !== 1) {
        throw createServiceError(
          409,
          "PAYMENT_BALANCE_CONFLICT",
          "The sale balance changed. Please refresh and try again.",
        );
      }

      const [payment] = await Payment.create(
        [
          {
            organization: organizationId,
            sale: sale._id,
            amountPaise,
            method: paymentData.method,
            reference: paymentData.reference || null,
            notes: paymentData.notes || null,
            receivedBy: userId,
          },
        ],
        { session },
      );

      const updatedSale = await Sale.findOne({
        _id: sale._id,
        organization: organizationId,
      }).session(session);

      result = {
        payment,
        sale: updatedSale,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
}

function normalizePaymentPagination(value, fallback, maximum = Infinity) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.min(parsed, maximum);
}

export async function getSalePayments({ organizationId, saleId, page, limit }) {
  if (!mongoose.isValidObjectId(saleId)) {
    throw createServiceError(400, "INVALID_SALE_ID", "Invalid sale ID");
  }

  const sale = await Sale.findOne({
    _id: saleId,
    organization: organizationId,
  }).select("_id");

  if (!sale) {
    throw createServiceError(404, "SALE_NOT_FOUND", "Sale not found");
  }

  const currentPage = normalizePaymentPagination(page, 1);
  const pageSize = normalizePaymentPagination(limit, 20, 100);
  const skip = (currentPage - 1) * pageSize;

  const filter = {
    organization: organizationId,
    sale: sale._id,
  };

  const [payments, totalPayments] = await Promise.all([
    Payment.find(filter)
      .populate("receivedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),

    Payment.countDocuments(filter),
  ]);

  return {
    payments,
    pagination: {
      currentPage,
      pageSize,
      totalPayments,
      totalPages: Math.ceil(totalPayments / pageSize),
      hasNextPage: skip + payments.length < totalPayments,
      hasPreviousPage: currentPage > 1,
    },
  };
}

export async function getPaymentById({ organizationId, saleId, paymentId }) {
  if (
    !mongoose.isValidObjectId(saleId) ||
    !mongoose.isValidObjectId(paymentId)
  ) {
    throw createServiceError(
      400,
      "INVALID_PAYMENT_ID",
      "Invalid sale or payment ID",
    );
  }

  const payment = await Payment.findOne({
    _id: paymentId,
    organization: organizationId,
    sale: saleId,
  }).populate("receivedBy", "name");

  if (!payment) {
    throw createServiceError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }

  return payment;
}
