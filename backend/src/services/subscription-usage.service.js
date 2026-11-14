import Subscription from "../models/subscription.model.js";
import Product from "../models/product.model.js";
import Membership from "../models/membership.model.js";
import Supplier from "../models/supplier.model.js";
import Customer from "../models/customer.model.js";

import { createServiceError } from "../utils/service-error.util.js";

function mapToObject(value) {
  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  return value ?? {};
}

export async function getOrganizationSubscriptionUsage({ organizationId }) {
  const subscription = await Subscription.findOne({
    organization: organizationId,
  }).populate({
    path: "plan",
    select: "entitlements.limits",
  });

  if (!subscription || !subscription.plan) {
    throw createServiceError(
      404,
      "SUBSCRIPTION_NOT_FOUND",
      "Organization subscription or its plan was not found",
    );
  }

  const [products, staff, suppliers, customers] = await Promise.all([
    Product.countDocuments({
      organization: organizationId,
    }),

    Membership.countDocuments({
      organization: organizationId,
      role: { $in: ["manager", "sales_staff"] },
      status: "active",
    }),

    Supplier.countDocuments({
      organization: organizationId,
    }),

    Customer.countDocuments({
      organization: organizationId,
    }),
  ]);

  const limits = mapToObject(subscription.plan.entitlements?.limits);

  const usage = {
    products,
    staff,
    suppliers,
    customers,
  };

  const resources = {};

  for (const [key, used] of Object.entries(usage)) {
    const limit = limits[key] ?? null;

    resources[key] = {
      used,
      limit,
      remaining: limit === null ? null : Math.max(limit - used, 0),
      unlimited: limit === null,
    };
  }

  return {
    resources,
  };
}
