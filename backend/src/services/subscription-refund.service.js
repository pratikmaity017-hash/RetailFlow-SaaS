import BillingPayment from "../models/billing-payment.model.js";
import {
  createRazorpayRefund,
  fetchRazorpayRefund,
} from "./razorpay.service.js";

const MAX_REFUND_RETRIES = 8;

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

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);

  const retryCount = payment.refundRetryCount ?? 0;

  // An existing Razorpay refund must be checked, never recreated.
  if (payment.razorpayRefundId) {
    const existingRefund = await fetchRazorpayRefund(payment.razorpayRefundId);

    if (
      existingRefund.paymentId !== payment.razorpayPaymentId ||
      existingRefund.amount !== payment.amountPaise ||
      existingRefund.currency !== payment.currency
    ) {
      throw createServiceError(
        "Existing Razorpay refund details do not match the billing payment",
        409,
        "REFUND_DETAILS_MISMATCH",
      );
    }

    const refundProcessed = existingRefund.status === "processed";
    const refundFailed = existingRefund.status === "failed";

    const update = {
      refundStatus: existingRefund.status,
      refundProcessingAt: null,
      refundManualReviewRequired: refundFailed,
    };

    if (refundProcessed) {
      update.status = "refunded";
      update.refundedAt = new Date();
    }

    const updatedPayment = await BillingPayment.findOneAndUpdate(
      {
        _id: payment._id,
        status: "refund_pending",
        razorpayRefundId: existingRefund.id,
        refundStatus: payment.refundStatus,
      },
      {
        $set: update,
      },
      { new: true },
    );

    if (!updatedPayment) {
      const latestPayment = await BillingPayment.findById(payment._id);

      if (latestPayment?.status === "refunded") {
        return { refunded: true, duplicate: true };
      }

      return {
        refunded: false,
        stateChanged: true,
        refundStatus: latestPayment?.refundStatus ?? "unknown",
        processing: latestPayment?.refundStatus === "processing",
      };
    }

    return {
      refunded: updatedPayment.status === "refunded",
      refundStatus: updatedPayment.refundStatus,
      refundId: existingRefund.id,
      refundManualReviewRequired: updatedPayment.refundManualReviewRequired,
      existingRefund: true,
    };
  }

  if (payment.refundManualReviewRequired) {
    return {
      refunded: false,
      manualReviewRequired: true,
      refundStatus: payment.refundStatus,
    };
  }

  if (retryCount >= MAX_REFUND_RETRIES) {
    const freshProcessing =
      payment.refundStatus === "processing" &&
      payment.refundProcessingAt &&
      payment.refundProcessingAt > staleBefore;

    if (freshProcessing) {
      return {
        refunded: false,
        processing: true,
        refundStatus: "processing",
      };
    }

    await BillingPayment.updateOne(
      { _id: payment._id },
      {
        $set: {
          refundManualReviewRequired: true,
        },
      },
    );

    return {
      refunded: false,
      retryLimitReached: true,
      manualReviewRequired: true,
      refundStatus: payment.refundStatus,
    };
  }

  if (!payment.razorpayPaymentId) {
    throw createServiceError(
      "Captured Razorpay payment ID is missing",
      409,
      "REFUND_PAYMENT_ID_MISSING",
    );
  }

  // Claim the refund operation. A stale processing claim can be retried
  // safely because the same Razorpay idempotency key is reused.
  const claimedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: payment._id,
      status: "refund_pending",
      $and: [
        {
          $or: [
            { refundRetryCount: { $lt: MAX_REFUND_RETRIES } },
            { refundRetryCount: { $exists: false } },
          ],
        },
        {
          $or: [
            { refundStatus: { $in: ["pending", "failed"] } },
            {
              refundStatus: "processing",
              refundProcessingAt: { $lte: staleBefore },
            },
          ],
        },
      ],
    },
    {
      $set: {
        refundStatus: "processing",
        refundProcessingAt: now,
      },
      $inc: {
        refundRetryCount: 1,
      },
    },
    { returnDocument: "after" },
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

  let refund;

  try {
    refund = await createRazorpayRefund({
      paymentId: claimedPayment.razorpayPaymentId,
      idempotencyKey: `retailflow-${claimedPayment._id}`,
      notes: {
        billingPaymentId: String(claimedPayment._id),
        reason: "Cancelled renewal checkout was captured",
      },
    });
  } catch (error) {
    // An unknown outcome must remain processing.
    // Recovery will retry with the same idempotency key.
    if (error.outcomeUnknown) {
      throw error;
    }

    // Only a definitive API rejection is marked failed.
    await BillingPayment.updateOne(
      {
        _id: claimedPayment._id,
        status: "refund_pending",
        refundStatus: "processing",
        refundProcessingAt: claimedPayment.refundProcessingAt,
      },
      {
        $set: {
          refundStatus: "failed",
          refundProcessingAt: null,
          refundManualReviewRequired:
            (claimedPayment.refundRetryCount ?? 0) >= MAX_REFUND_RETRIES,
        },
      },
    );

    throw error;
  }

  // Database persistence is deliberately outside the API catch.
  // If this fails, the processing claim remains for later recovery.
  const refundProcessed = refund.status === "processed";
  const refundFailed = refund.status === "failed";

  const update = {
    razorpayRefundId: refund.id,
    refundStatus: refund.status,
    refundProcessingAt: null,
    refundManualReviewRequired:
      !refundProcessed &&
      (refundFailed ||
        (claimedPayment.refundRetryCount ?? 0) >= MAX_REFUND_RETRIES),
  };

  if (refundProcessed) {
    update.status = "refunded";
    update.refundedAt = new Date();
  }

  const updatedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: claimedPayment._id,
      status: "refund_pending",
      refundStatus: "processing",
      refundProcessingAt: claimedPayment.refundProcessingAt,
    },
    {
      $set: update,
    },
    { new: true },
  );

  if (!updatedPayment) {
    const latestPayment = await BillingPayment.findById(claimedPayment._id);

    if (latestPayment?.status === "refunded") {
      return { refunded: true, duplicate: true };
    }

    return {
      refunded: false,
      stateChanged: true,
      refundStatus: latestPayment?.refundStatus ?? "unknown",
    };
  }

  return {
    refunded: updatedPayment.status === "refunded",
    refundStatus: updatedPayment.refundStatus,
    refundId: refund.id,
    refundManualReviewRequired: updatedPayment.refundManualReviewRequired,
  };
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

  // Never allow a different refund to update this payment.
  if (payment.razorpayRefundId && payment.razorpayRefundId !== refund.id) {
    throw createServiceError(
      "Refund ID does not match the existing billing refund",
      409,
      "REFUND_ID_MISMATCH",
    );
  }

  const isProcessed = eventType === "refund.processed";
  const expectedRefundStatus = isProcessed ? "processed" : "failed";

  // Already processed webhook or completed refund.
  if (
    payment.status === "refunded" ||
    payment.refundStatus === expectedRefundStatus
  ) {
    return {
      updated: false,
      duplicate: true,
      status: payment.status,
      refundStatus: payment.refundStatus,
    };
  }

  const update = {
    razorpayRefundId: refund.id,
    refundStatus: expectedRefundStatus,
    refundProcessingAt: null,
    refundManualReviewRequired: !isProcessed,
  };

  if (isProcessed) {
    update.status = "refunded";
    update.refundedAt = new Date();
  }

  const updatedPayment = await BillingPayment.findOneAndUpdate(
    {
      _id: payment._id,
      status: "refund_pending",
      refundStatus: payment.refundStatus,
      $or: [{ razorpayRefundId: refund.id }, { razorpayRefundId: null }],
    },
    {
      $set: update,
    },
    { new: true },
  );

  if (!updatedPayment) {
    const latestPayment = await BillingPayment.findById(payment._id);

    if (
      latestPayment?.razorpayRefundId === refund.id &&
      (latestPayment.status === "refunded" ||
        latestPayment.refundStatus === expectedRefundStatus)
    ) {
      return {
        updated: false,
        duplicate: true,
        status: latestPayment.status,
        refundStatus: latestPayment.refundStatus,
      };
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

export async function recoverPendingRenewalRefunds({ batchSize = 10 } = {}) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);

  await BillingPayment.updateMany(
    {
      paymentType: "renewal",
      status: "refund_pending",
      refundManualReviewRequired: { $ne: true },
      refundRetryCount: { $gte: MAX_REFUND_RETRIES },
      razorpayRefundId: { $in: [null, ""] },
      $or: [
        { refundStatus: { $ne: "processing" } },
        { refundProcessingAt: { $lte: staleBefore } },
        { refundProcessingAt: { $exists: false } },
        { refundProcessingAt: null },
      ],
    },
    {
      $set: {
        refundManualReviewRequired: true,
      },
    },
  );

  const candidates = await BillingPayment.find({
    paymentType: "renewal",
    status: "refund_pending",
    refundManualReviewRequired: { $ne: true },
    $and: [
      {
        $or: [
          {
            razorpayRefundId: {
              $exists: true,
              $nin: [null, ""],
            },
          },
          { refundRetryCount: { $lt: MAX_REFUND_RETRIES } },
          { refundRetryCount: { $exists: false } },
        ],
      },
      {
        $or: [
          {
            refundStatus: { $in: ["pending", "failed"] },
            updatedAt: { $lte: staleBefore },
          },
          {
            refundStatus: "processing",
            refundProcessingAt: { $lte: staleBefore },
          },
        ],
      },
    ],
  })
    .select("_id")
    .sort({ updatedAt: 1 })
    .limit(batchSize)
    .lean();

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      const result = await processCancelledRenewalRefund({
        billingPaymentId: candidate._id,
      });

      if (result.refunded || result.refundStatus === "processed") {
        processed += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      failed += 1;

      console.error(
        `Refund recovery failed for payment ${candidate._id}:`,
        error.message,
      );
    }
  }

  return {
    checked: candidates.length,
    processed,
    failed,
    skipped,
  };
}
