import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";

import { env } from "../config/env.js";
import { createRazorpayOrder } from "./razorpay.service.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export async function createSubscriptionRenewal({
  organizationId,
  billingInterval,
}) {
  if (!["monthly", "yearly"].includes(billingInterval)) {
    throw createServiceError(
      "Invalid billing interval",
      400,
      "INVALID_BILLING_INTERVAL",
    );
  }

  const subscription = await Subscription.findOne({
    organization: organizationId,
  }).populate("plan", "code name isActive prices");

  if (!subscription) {
    throw createServiceError(
      "Organization subscription was not found",
      404,
      "SUBSCRIPTION_NOT_FOUND",
    );
  }

  if (!subscription.plan) {
    throw createServiceError(
      "Current subscription plan was not found",
      404,
      "SUBSCRIPTION_PLAN_NOT_FOUND",
    );
  }

  if (subscription.plan.code === "free") {
    throw createServiceError(
      "Free plan does not require renewal",
      400,
      "FREE_PLAN_RENEWAL_NOT_REQUIRED",
    );
  }

  if (!subscription.plan.isActive) {
    throw createServiceError(
      "Current subscription plan is no longer available",
      409,
      "SUBSCRIPTION_PLAN_INACTIVE",
    );
  }

  if (!["active", "past_due", "expired"].includes(subscription.status)) {
    throw createServiceError(
      "Subscription is not eligible for renewal",
      409,
      "SUBSCRIPTION_NOT_ELIGIBLE_FOR_RENEWAL",
    );
  }

  if (!subscription.currentPeriodEnd) {
    throw createServiceError(
      "Subscription period end date is not configured",
      409,
      "SUBSCRIPTION_PERIOD_NOT_CONFIGURED",
    );
  }

  const selectedPrice = subscription.plan.prices?.[billingInterval];

  if (
    !selectedPrice ||
    !Number.isSafeInteger(selectedPrice.amountPaise) ||
    selectedPrice.amountPaise <= 0
  ) {
    throw createServiceError(
      "Selected plan price is not configured",
      400,
      "PLAN_PRICE_NOT_CONFIGURED",
    );
  }

  const existingPendingPayment = await BillingPayment.findOne({
    organization: organizationId,
    status: { $in: ["pending", "authorized"] },
  }).select("_id");

  if (existingPendingPayment) {
    throw createServiceError(
      "A payment is already pending for this organization",
      409,
      "CHECKOUT_ALREADY_PENDING",
    );
  }

  const billingPayment = await BillingPayment.create({
    organization: organizationId,
    subscription: subscription._id,
    plan: subscription.plan._id,
    paymentType: "renewal",
    amountPaise: selectedPrice.amountPaise,
    currency: selectedPrice.currency || "INR",
    billingInterval,
    status: "pending",
    gateway: "razorpay",
  });

  try {
    const razorpayOrder = await createRazorpayOrder({
      amountPaise: billingPayment.amountPaise,
      currency: billingPayment.currency,
      receipt: billingPayment._id.toString(),
      notes: {
        billingPaymentId: billingPayment._id.toString(),
        organizationId: organizationId.toString(),
        planCode: subscription.plan.code,
        billingInterval,
        paymentType: "renewal",
      },
    });

    billingPayment.razorpayOrderId = razorpayOrder.id;
    await billingPayment.save();

    return {
      payment: {
        id: billingPayment._id,
        type: billingPayment.paymentType,
        amountPaise: billingPayment.amountPaise,
        currency: billingPayment.currency,
        status: billingPayment.status,
      },

      checkout: {
        keyId: env.RAZORPAY_KEY_ID,
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,

        plan: {
          code: subscription.plan.code,
          name: subscription.plan.name,
        },

        billingInterval,
        paymentType: "renewal",
      },
    };
  } catch (error) {
    billingPayment.status = "failed";
    billingPayment.failureReason = "Unable to create Razorpay renewal order";

    await billingPayment.save().catch(() => {});

    throw error;
  }
}
