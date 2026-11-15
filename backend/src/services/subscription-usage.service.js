import Subscription from "../models/subscription.model.js";
import Product from "../models/product.model.js";
import Membership from "../models/membership.model.js";
import Supplier from "../models/supplier.model.js";
import Customer from "../models/customer.model.js";
import OrganizationInvitation from "../models/organization-invitation.model.js";

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

  const now = new Date();

  const [products, activeStaff, pendingInvitations, suppliers, customers] =
    await Promise.all([
      Product.countDocuments({
        organization: organizationId,
        status: "active",
      }),

      Membership.countDocuments({
        organization: organizationId,
        role: { $in: ["manager", "sales_staff"] },
        status: "active",
      }),

      OrganizationInvitation.countDocuments({
        organization: organizationId,
        role: { $in: ["manager", "sales_staff"] },
        status: "pending",
        expiresAt: { $gt: now },
      }),

      Supplier.countDocuments({
        organization: organizationId,
        status: "active",
      }),

      Customer.countDocuments({
        organization: organizationId,
        status: "active",
      }),
    ]);

  const limits = mapToObject(subscription.plan.entitlements?.limits);

  const usage = {
    products,
    staff: activeStaff + pendingInvitations,
    suppliers,
    customers,
  };

  const resources = {};

  for (const [key, used] of Object.entries(usage)) {
    if (!Object.hasOwn(limits, key)) {
      throw createServiceError(
        500,
        "SUBSCRIPTION_LIMIT_NOT_CONFIGURED",
        `The ${key} limit is not configured for this plan`,
      );
    }

    const limit = limits[key];

    if (limit !== null && (!Number.isSafeInteger(limit) || limit < 0)) {
      throw createServiceError(
        500,
        "INVALID_SUBSCRIPTION_LIMIT",
        `The ${key} limit configuration is invalid`,
      );
    }

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
