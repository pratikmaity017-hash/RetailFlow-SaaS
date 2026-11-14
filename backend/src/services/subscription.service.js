import Subscription from "../models/subscription.model.js";
import { createServiceError } from "../utils/service-error.util.js";

export async function getOrganizationSubscription({ organizationId }) {
  const subscription = await Subscription.findOne({
    organization: organizationId,
  }).populate({
    path: "plan",
    select: "code name description prices entitlements isActive",
  });

  if (!subscription) {
    throw createServiceError(
      404,
      "SUBSCRIPTION_NOT_FOUND",
      "Subscription not found for this organization",
    );
  }

  if (!subscription.plan) {
    throw createServiceError(
      500,
      "SUBSCRIPTION_PLAN_UNAVAILABLE",
      "The subscription plan could not be found",
    );
  }

  const plan = subscription.plan;

  return {
    subscription: {
      id: subscription._id,
      status: subscription.status,
      billingInterval: subscription.billingInterval,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      nextBillingAt: subscription.nextBillingAt,
      gracePeriodEndsAt: subscription.gracePeriodEndsAt,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      canceledAt: subscription.canceledAt,
      pendingChange: subscription.pendingChange,
      lastPaymentAt: subscription.lastPaymentAt,
    },

    plan: {
      id: plan._id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      prices: {
        monthly: plan.prices?.monthly ?? null,
        yearly: plan.prices?.yearly ?? null,
      },
      entitlements: {
        features: Object.fromEntries(plan.entitlements?.features ?? []),
        limits: Object.fromEntries(plan.entitlements?.limits ?? []),
      },
      isActive: plan.isActive,
    },
  };
}
