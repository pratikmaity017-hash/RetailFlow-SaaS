import BillingPayment from "../models/billing-payment.model.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";
import { env } from "../config/env.js";
import { createRazorpayOrder } from "./razorpay.service.js";

function createServiceError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export async function createSubscriptionCheckout({
  organizationId,
  planCode,
  billingInterval,
}) {
  if (!["monthly", "yearly"].includes(billingInterval)) {
    throw createServiceError(
      "Invalid billing interval",
      400,
      "INVALID_BILLING_INTERVAL",
    );
  }

  // Load the organization's current subscription.
  const subscription = await Subscription.findOne({
    organization: organizationId,
  }).populate("plan", "code name isActive");

  if (!subscription) {
    throw createServiceError(
      "Organization subscription was not found",
      404,
      "SUBSCRIPTION_NOT_FOUND",
    );
  }

  if (subscription.status !== "active" || !subscription.plan?.isActive) {
    throw createServiceError(
      "Current subscription is not eligible for checkout",
      409,
      "SUBSCRIPTION_NOT_ELIGIBLE",
    );
  }

  // Checkout is only for organizations currently on the Free plan.
  if (subscription.plan.code !== "free") {
    throw createServiceError(
      "Paid subscription changes must use the plan change process",
      409,
      "PAID_SUBSCRIPTION_ALREADY_EXISTS",
    );
  }

  const requestedPlan = await SubscriptionPlan.findOne({
    code: planCode,
    isActive: true,
  });

  if (!requestedPlan) {
    throw createServiceError(
      "Selected subscription plan was not found",
      404,
      "SUBSCRIPTION_PLAN_NOT_FOUND",
    );
  }

  if (requestedPlan.code === "free") {
    throw createServiceError(
      "Free plan does not require checkout",
      400,
      "FREE_PLAN_DOES_NOT_REQUIRE_CHECKOUT",
    );
  }

  const selectedPrice = requestedPlan.prices?.[billingInterval];

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

  // Do not create another order while an earlier checkout is unresolved.
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

  // Create the local payment record before contacting Razorpay.
  const billingPayment = await BillingPayment.create({
    organization: organizationId,
    subscription: subscription._id,
    plan: requestedPlan._id,
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
        planCode: requestedPlan.code,
        billingInterval,
      },
    });

    billingPayment.razorpayOrderId = razorpayOrder.id;
    await billingPayment.save();

    return {
      payment: {
        id: billingPayment._id,
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
          code: requestedPlan.code,
          name: requestedPlan.name,
        },
        billingInterval,
      },
    };
  } catch (error) {
    billingPayment.status = "failed";
    billingPayment.failureReason = "Unable to create Razorpay payment order";
    await billingPayment.save().catch(() => {});

    throw error;
  }
}
