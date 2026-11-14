import WebhookEvent from "../models/webhook-event.model.js";

import { processCapturedPaymentFromWebhook } from "./subscription-payment.service.js";

import { fetchRazorpayOrderPayments } from "./razorpay.service.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

async function processPaymentEvent(eventType, payload) {
  if (eventType === "payment.failed") {
    // A failed attempt does not necessarily mean the entire order failed.
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

  await processCapturedPaymentFromWebhook({
    orderId: payment.order_id,
    paymentId: payment.id,
    amount: payment.amount,
    currency: payment.currency,
  });
}

export async function processRazorpayWebhook({ eventId, eventType, payload }) {
  if (!eventId || !eventType || !payload) {
    throw createServiceError(
      "Webhook event details are incomplete",
      400,
      "WEBHOOK_EVENT_DETAILS_INVALID",
    );
  }

  let webhookEvent;

  try {
    webhookEvent = await WebhookEvent.create({
      eventId,
      eventType,
      payload,
      status: "processing",
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }

    webhookEvent = await WebhookEvent.findOne({ eventId });

    if (!webhookEvent) {
      throw error;
    }

    if (webhookEvent.status === "processed") {
      return { duplicate: true, processed: true };
    }

    if (webhookEvent.status === "processing") {
      return { duplicate: true, processing: true };
    }

    webhookEvent.status = "processing";
    webhookEvent.retryCount += 1;
    webhookEvent.failureReason = null;

    await webhookEvent.save();
  }

  try {
    await processPaymentEvent(eventType, payload);

    webhookEvent.status = "processed";
    webhookEvent.processedAt = new Date();
    webhookEvent.failureReason = null;

    await webhookEvent.save();

    return {
      duplicate: false,
      processed: true,
    };
  } catch (error) {
    webhookEvent.status = "failed";
    webhookEvent.failureReason = error.message;

    await webhookEvent.save();

    throw error;
  }
}
