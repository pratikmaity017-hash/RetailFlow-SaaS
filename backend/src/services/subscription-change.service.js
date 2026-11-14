import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";

import { createServiceError } from "../utils/service-error.util.js";

export async function requestSubscriptionPlanChange({
  organizationId,
  planCode,
  billingInterval,
}) {
  if (!["monthly", "yearly"].includes(billingInterval)) {
    throw createServiceError(
      400,
      "INVALID_BILLING_INTERVAL",
      "Billing interval must be monthly or yearly",
    );
  }

  const subscription = await Subscription.findOne({
    organization: organizationId,
  }).populate("plan");

  if (!subscription || !subscription.plan) {
    throw createServiceError(
      404,
      "SUBSCRIPTION_NOT_FOUND",
      "Organization subscription was not found",
    );
  }

  if (subscription.plan.code === "free") {
    throw createServiceError(
      400,
      "FREE_PLAN_CHANGE_REQUIRES_CHECKOUT",
      "Upgrading from Free plan requires the payment checkout process",
    );
  }

  if (subscription.status !== "active") {
    throw createServiceError(
      400,
      "SUBSCRIPTION_NOT_ACTIVE",
      "Only active subscriptions can schedule a plan change",
    );
  }

  if (subscription.cancelAtPeriodEnd) {
    throw createServiceError(
      400,
      "SUBSCRIPTION_CANCELLATION_SCHEDULED",
      "Cannot change plan while subscription cancellation is scheduled",
    );
  }

  if (subscription.pendingChange) {
    throw createServiceError(
      409,
      "PLAN_CHANGE_ALREADY_PENDING",
      "A subscription plan change is already scheduled",
    );
  }

  if (
    !subscription.currentPeriodEnd ||
    subscription.currentPeriodEnd <= new Date()
  ) {
    throw createServiceError(
      400,
      "INVALID_BILLING_PERIOD",
      "A valid future billing period end date is required",
    );
  }

  const requestedPlan = await SubscriptionPlan.findOne({
    code: planCode,
    isActive: true,
  });

  if (!requestedPlan) {
    throw createServiceError(
      404,
      "SUBSCRIPTION_PLAN_NOT_FOUND",
      "Requested subscription plan is unavailable",
    );
  }

  const requestedPrice = requestedPlan.prices?.[billingInterval];

  if (!requestedPrice) {
    throw createServiceError(
      400,
      "PLAN_PRICE_UNAVAILABLE",
      "Requested billing interval is not configured for this plan",
    );
  }

  if (
    subscription.plan._id.equals(requestedPlan._id) &&
    subscription.billingInterval === billingInterval
  ) {
    throw createServiceError(
      400,
      "SAME_SUBSCRIPTION_PLAN",
      "You are already subscribed to this plan and billing interval",
    );
  }

  subscription.pendingChange = {
    plan: requestedPlan._id,
    billingInterval,
    effectiveAt: subscription.currentPeriodEnd,
  };

  await subscription.save();

  return {
    pendingChange: {
      plan: {
        code: requestedPlan.code,
        name: requestedPlan.name,
      },
      billingInterval,
      effectiveAt: subscription.pendingChange.effectiveAt,
    },
  };
}
