import { randomUUID } from "node:crypto";
import WebhookEvent from "../models/webhook-event.model.js";

import {
  processCapturedPaymentFromWebhook,
  processFailedPaymentFromWebhook,
  reconcileWebhookRazorpayOrder,
} from "./subscription-payment.service.js";

import { fetchRazorpayOrderPayments } from "./razorpay.service.js";
import {
  processCancelledRenewalRefund,
  processRefundWebhook,
} from "./subscription-refund.service.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

const WEBHOOK_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

const WEBHOOK_MAX_RETRIES = 8;
const WEBHOOK_RETRY_BASE_DELAY_MS = 60 * 1000;
const WEBHOOK_RETRY_MAX_DELAY_MS = 60 * 60 * 1000;

function isRetryableWebhookError(error) {
  const statusCode = error.statusCode;

  if (!Number.isInteger(statusCode)) {
    return true;
  }

  return (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 429 ||
    statusCode >= 500
  );
}

function calculateWebhookRetryDelay(retryCount) {
  const delay = WEBHOOK_RETRY_BASE_DELAY_MS * 2 ** Math.max(0, retryCount);

  return Math.min(delay, WEBHOOK_RETRY_MAX_DELAY_MS);
}

async function claimExistingWebhookEvent({ eventId, processingToken }) {
  const now = new Date();

  const staleBefore = new Date(now.getTime() - WEBHOOK_PROCESSING_TIMEOUT_MS);

  return WebhookEvent.findOneAndUpdate(
    {
      eventId,
      $or: [
        {
          status: "failed",
          nextRetryAt: { $lte: now },
        },
        {
          status: "processing",
          $or: [
            { processingStartedAt: { $lte: staleBefore } },
            { processingStartedAt: null },
            { processingStartedAt: { $exists: false } },
          ],
        },
      ],
      retryCount: { $lt: WEBHOOK_MAX_RETRIES },
    },
    {
      $set: {
        status: "processing",
        processingStartedAt: now,
        processingToken,
        failureReason: null,
        nextRetryAt: null,
      },
      $inc: {
        retryCount: 1,
      },
    },
    {
      returnDocument: "after",
    },
  );
}

async function processPaymentEvent(eventType, payload) {
  if (eventType === "refund.processed" || eventType === "refund.failed") {
    const eventPayload = payload?.payload ?? payload;
    const refund = eventPayload?.refund?.entity;

    await processRefundWebhook({
      eventType,
      refund,
    });

    return;
  }
  if (eventType === "payment.failed") {
    const eventPayload = payload?.payload ?? payload;
    const payment = eventPayload?.payment?.entity;

    if (!payment?.id || !payment?.order_id) {
      throw createServiceError(
        "Failed webhook payment details are missing",
        400,
        "WEBHOOK_FAILED_PAYMENT_DETAILS_MISSING",
      );
    }

    await reconcileWebhookRazorpayOrder(payment.order_id);

    await processFailedPaymentFromWebhook({
      orderId: payment.order_id,
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
    });

    return;
  }

  // Razorpay sends payment/order entities inside payload.payload.
  // The fallback also supports a directly nested payload structure.
  const eventPayload = payload?.payload ?? payload;

  let payment = eventPayload?.payment?.entity;
  const order = eventPayload?.order?.entity;

  if (eventType === "order.paid" && !payment?.id) {
    const orderId = order?.id;

    if (!orderId) {
      throw createServiceError(
        "Paid order details are missing",
        400,
        "WEBHOOK_ORDER_DETAILS_MISSING",
      );
    }

    const payments = await fetchRazorpayOrderPayments(orderId);

    const matchingPayments = payments.filter(
      (item) =>
        item.orderId === orderId &&
        item.status === "captured" &&
        item.captured === true,
    );

    if (matchingPayments.length !== 1) {
      throw createServiceError(
        "Could not identify one captured payment for this order",
        409,
        "WEBHOOK_CAPTURED_PAYMENT_AMBIGUOUS",
      );
    }

    payment = {
      id: matchingPayments[0].id,
      order_id: matchingPayments[0].orderId,
      amount: matchingPayments[0].amount,
      currency: matchingPayments[0].currency,
    };
  }

  if (!payment?.id || !payment?.order_id) {
    throw createServiceError(
      "Webhook payment details are missing",
      400,
      "WEBHOOK_PAYMENT_DETAILS_MISSING",
    );
  }

  await reconcileWebhookRazorpayOrder(payment.order_id);

  const result = await processCapturedPaymentFromWebhook({
    orderId: payment.order_id,
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
  });

  if (result?.refundRequired && result.billingPaymentId) {
    await processCancelledRenewalRefund({
      billingPaymentId: result.billingPaymentId,
    });
  }
}

export async function processRazorpayWebhook({ eventId, eventType, payload }) {
  if (!eventId || !eventType || !payload) {
    throw createServiceError(
      "Webhook event details are incomplete",
      400,
      "WEBHOOK_EVENT_DETAILS_INVALID",
    );
  }

  const processingToken = randomUUID();

  let webhookEvent;

  try {
    webhookEvent = await WebhookEvent.create({
      eventId,
      eventType,
      payload,
      status: "processing",
      processingStartedAt: new Date(),
      processingToken,
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    webhookEvent = await claimExistingWebhookEvent({
      eventId,
      processingToken,
    });

    if (!webhookEvent) {
      const existingEvent = await WebhookEvent.findOne({ eventId });

      if (!existingEvent) {
        throw error;
      }

      if (existingEvent.status === "processed") {
        return {
          duplicate: true,
          processed: true,
        };
      }

      return {
        duplicate: true,
        processing: true,
      };
    }
  }

  // Always process the stored event data, not duplicate request data.
  const storedEventType = webhookEvent.eventType;
  const storedPayload = webhookEvent.payload;

  try {
    await processPaymentEvent(storedEventType, storedPayload);

    const completedEvent = await WebhookEvent.findOneAndUpdate(
      {
        _id: webhookEvent._id,
        status: "processing",
        processingToken,
      },
      {
        $set: {
          status: "processed",
          processedAt: new Date(),
          processingStartedAt: null,
          processingToken: null,
          failureReason: null,
          nextRetryAt: null,
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!completedEvent) {
      return {
        duplicate: true,
        processing: true,
      };
    }

    return {
      duplicate: false,
      processed: true,
    };
  } catch (error) {
    const shouldRetry =
      isRetryableWebhookError(error) &&
      webhookEvent.retryCount < WEBHOOK_MAX_RETRIES;

    const nextRetryAt = shouldRetry
      ? new Date(
          Date.now() + calculateWebhookRetryDelay(webhookEvent.retryCount),
        )
      : null;

    await WebhookEvent.findOneAndUpdate(
      {
        _id: webhookEvent._id,
        status: "processing",
        processingToken,
      },
      {
        $set: {
          status: "failed",
          processingStartedAt: null,
          processingToken: null,
          failureReason: error.message.slice(0, 1000),
          nextRetryAt,
        },
      },
    );

    throw error;
  }
}

export async function recoverWebhookEvents({ batchSize = 10 } = {}) {
  const now = new Date();

  const staleBefore = new Date(now.getTime() - WEBHOOK_PROCESSING_TIMEOUT_MS);

  const candidates = await WebhookEvent.find({
    retryCount: { $lt: WEBHOOK_MAX_RETRIES },
    $or: [
      {
        status: "failed",
        nextRetryAt: { $lte: now },
      },
      {
        status: "processing",
        $or: [
          { processingStartedAt: { $lte: staleBefore } },
          { processingStartedAt: null },
          { processingStartedAt: { $exists: false } },
        ],
      },
    ],
  })
    .select("_id")
    .sort({ createdAt: 1 })
    .limit(batchSize)
    .lean();

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const processingToken = randomUUID();
    const claimTime = new Date();

    const claimStaleBefore = new Date(
      claimTime.getTime() - WEBHOOK_PROCESSING_TIMEOUT_MS,
    );

    const claimedEvent = await WebhookEvent.findOneAndUpdate(
      {
        _id: candidate._id,
        retryCount: { $lt: WEBHOOK_MAX_RETRIES },
        $or: [
          {
            status: "failed",
            nextRetryAt: { $lte: claimTime },
          },
          {
            status: "processing",
            $or: [
              { processingStartedAt: { $lte: claimStaleBefore } },
              { processingStartedAt: null },
              { processingStartedAt: { $exists: false } },
            ],
          },
        ],
      },
      {
        $set: {
          status: "processing",
          processingStartedAt: claimTime,
          processingToken,
          failureReason: null,
          nextRetryAt: null,
        },
        $inc: {
          retryCount: 1,
        },
      },
      {
        returnDocument: "after",
      },
    );

    if (!claimedEvent) {
      skipped += 1;
      continue;
    }

    try {
      await processPaymentEvent(claimedEvent.eventType, claimedEvent.payload);

      const completedEvent = await WebhookEvent.findOneAndUpdate(
        {
          _id: claimedEvent._id,
          status: "processing",
          processingToken,
        },
        {
          $set: {
            status: "processed",
            processedAt: new Date(),
            processingStartedAt: null,
            processingToken: null,
            failureReason: null,
            nextRetryAt: null,
          },
        },
      );

      if (completedEvent) {
        processed += 1;
      } else {
        skipped += 1;
      }
    } catch (error) {
      const shouldRetry =
        isRetryableWebhookError(error) &&
        claimedEvent.retryCount < WEBHOOK_MAX_RETRIES;

      const nextRetryAt = shouldRetry
        ? new Date(
            Date.now() + calculateWebhookRetryDelay(claimedEvent.retryCount),
          )
        : null;

      await WebhookEvent.findOneAndUpdate(
        {
          _id: claimedEvent._id,
          status: "processing",
          processingToken,
        },
        {
          $set: {
            status: "failed",
            processingStartedAt: null,
            processingToken: null,
            failureReason: error.message.slice(0, 1000),
            nextRetryAt,
          },
        },
      );

      failed += 1;

      console.error(
        `Webhook recovery failed for event ${claimedEvent.eventId}:`,
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
