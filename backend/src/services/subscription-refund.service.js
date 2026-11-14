import BillingPayment from "../models/billing-payment.model.js";
import { createRazorpayRefund } from "./razorpay.service.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export async function processCancelledRenewalRefund({ billingPaymentId }) {
  const payment = await BillingPayment.findById(billingPaymentId);

  if (!payment) {
    throw createServiceError(
      "Billing payment was not found",
      404,
      "BILLING_PAYMENT_NOT_FOUND",
    );
  }

  if (payment.status === "refunded") {
    return { refunded: true, duplicate: true };
  }

  if (payment.status !== "refund_pending") {
    throw createServiceError(
      "Cancelled renewal payment is not awaiting a refund",
      409,
      "REFUND_NOT_REQUIRED",
    );
  }
  if (!payment.razorpayPaymentId) {
    throw createServiceError(
      "Captured Razorpay payment ID is missing",
      409,
      "REFUND_PAYMENT_ID_MISSING",
    );
  }

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);

  // Claim the refund operation. A stale processing claim can be retried
  // safely because the same Razorpay idempotency key is reused.
  const claimedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: payment._id,
      status: "refund_pending",
      $or: [
        { refundStatus: { $in: ["pending", "failed"] } },
        {
          refundStatus: "processing",
          refundProcessingAt: { $lte: staleBefore },
        },
      ],
    },
    {
      $set: {
        refundStatus: "processing",
        refundProcessingAt: now,
      },
    },
    { new: true },
  );

  if (!claimedPayment) {
    const latestPayment = await BillingPayment.findById(payment._id);

    if (latestPayment?.status === "refunded") {
      return { refunded: true, duplicate: true };
    }

    return {
      refunded: false,
      processing: latestPayment?.refundStatus === "processing",
      refundStatus: latestPayment?.refundStatus ?? "unknown",
    };
  }

  try {
    const refund = await createRazorpayRefund({
      paymentId: claimedPayment.razorpayPaymentId,
      idempotencyKey: `retailflow-${claimedPayment._id}`,
      notes: {
        billingPaymentId: String(claimedPayment._id),
        reason: "Cancelled renewal checkout was captured",
      },
    });

    const refundProcessed = refund.status === "processed";
    const refundFailed = refund.status === "failed";

    const update = {
      razorpayRefundId: refund.id,
      refundStatus: refundProcessed
        ? "processed"
        : refundFailed
          ? "failed"
          : "pending",
      refundProcessingAt: null,
    };

    if (refundProcessed) {
      update.status = "refunded";
      update.refundedAt = new Date();
    }

    await BillingPayment.updateOne(
      { _id: claimedPayment._id, status: "refund_pending" },
      { $set: update },
    );

    return {
      refunded: refundProcessed,
      refundStatus: update.refundStatus,
      refundId: refund.id,
    };
  } catch (error) {
    await BillingPayment.updateOne(
      { _id: claimedPayment._id, status: "refund_pending" },
      {
        $set: {
          refundStatus: "failed",
          refundProcessingAt: null,
        },
      },
    );

    throw error;
  }
}

export async function processRefundWebhook({ eventType, refund }) {
  if (!["refund.processed", "refund.failed"].includes(eventType)) {
    throw createServiceError(
      "Unsupported refund webhook event",
      400,
      "UNSUPPORTED_REFUND_EVENT",
    );
  }

  if (
    !refund?.id ||
    !refund?.payment_id ||
    !Number.isSafeInteger(refund.amount) ||
    !refund.currency ||
    refund.status !==
      (eventType === "refund.processed" ? "processed" : "failed")
  ) {
    throw createServiceError(
      "Refund webhook details are invalid",
      400,
      "INVALID_REFUND_WEBHOOK_DETAILS",
    );
  }

  const payment = await BillingPayment.findOne({
    razorpayPaymentId: refund.payment_id,
    status: { $in: ["refund_pending", "refunded"] },
  });

  if (!payment) {
    throw createServiceError(
      "Matching cancelled renewal payment was not found",
      404,
      "REFUND_BILLING_PAYMENT_NOT_FOUND",
    );
  }

  if (
    payment.paymentType !== "renewal" ||
    payment.amountPaise !== refund.amount ||
    payment.currency !== refund.currency
  ) {
    throw createServiceError(
      "Refund details do not match the billing payment",
      409,
      "REFUND_DETAILS_MISMATCH",
    );
  }

  if (payment.status === "refunded") {
    return { updated: false, duplicate: true, status: "refunded" };
  }

  const isProcessed = eventType === "refund.processed";

  const update = {
    razorpayRefundId: refund.id,
    refundStatus: isProcessed ? "processed" : "failed",
    refundProcessingAt: null,
  };

  if (isProcessed) {
    update.status = "refunded";
    update.refundedAt = new Date();
  }

  const updatedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: payment._id,
      status: "refund_pending",
    },
    { $set: update },
    { new: true },
  );

  if (!updatedPayment) {
    const latestPayment = await BillingPayment.findById(payment._id);

    if (latestPayment?.status === "refunded") {
      return { updated: false, duplicate: true, status: "refunded" };
    }

    throw createServiceError(
      "Billing payment changed while processing refund webhook",
      409,
      "REFUND_WEBHOOK_UPDATE_CONFLICT",
    );
  }

  return {
    updated: true,
    status: updatedPayment.status,
    refundStatus: updatedPayment.refundStatus,
    refundId: refund.id,
  };
}
