import SubscriptionPlan from "../models/subscription-plan.model.js";

function mapToObject(value) {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  return value ?? {};
}

export async function getAvailableSubscriptionPlans() {
  const plans = await SubscriptionPlan.find({
    isActive: true,
  })
    .select(
      "code name description prices.monthly.amountPaise prices.monthly.currency prices.yearly.amountPaise prices.yearly.currency entitlements.features entitlements.limits isActive sortOrder",
    )
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return {
    plans: plans.map((plan) => ({
      id: plan._id,
      code: plan.code,
      name: plan.name,
      description: plan.description,

      prices: {
        monthly: plan.prices?.monthly ?? null,
        yearly: plan.prices?.yearly ?? null,
      },

      entitlements: {
        features: mapToObject(plan.entitlements?.features),
        limits: mapToObject(plan.entitlements?.limits),
      },

      isActive: plan.isActive,
    })),
  };
}
