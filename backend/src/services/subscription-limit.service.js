import mongoose from "mongoose";

import Organization from "../models/organization.model.js";
import Subscription from "../models/subscription.model.js";

import Product from "../models/product.model.js";
import Customer from "../models/customer.model.js";
import Supplier from "../models/supplier.model.js";
import Membership from "../models/membership.model.js";
import OrganizationInvitation from "../models/organization-invitation.model.js";

import { createServiceError } from "../utils/service-error.util.js";

const RESOURCE_MODELS = {
  products: Product,
  customers: Customer,
  suppliers: Supplier,
};

function getLimitValue(limits, resource) {
  if (limits instanceof Map) {
    return limits.get(resource);
  }

  return limits?.[resource];
}

async function getResourceUsage({ organizationId, resource, session }) {
  if (RESOURCE_MODELS[resource]) {
    return RESOURCE_MODELS[resource]
      .countDocuments({
        organization: organizationId,
        status: "active",
      })
      .session(session);
  }

  if (resource === "staff") {
    const now = new Date();

    const activeMembers = await Membership.countDocuments({
      organization: organizationId,
      role: { $in: ["manager", "sales_staff"] },
      status: "active",
    }).session(session);

    const pendingInvitations = await OrganizationInvitation.countDocuments({
      organization: organizationId,
      role: { $in: ["manager", "sales_staff"] },
      status: "pending",
      expiresAt: { $gt: now },
    }).session(session);

    return activeMembers + pendingInvitations;
  }
  throw createServiceError(
    500,
    "UNSUPPORTED_LIMIT_RESOURCE",
    "The requested subscription limit resource is not supported",
  );
}

export async function withSubscriptionLimit({
  organizationId,
  resource,
  operation,
}) {
  const session = await mongoose.startSession();

  let result;

  try {
    await session.withTransaction(async () => {
      // Serialize limit-sensitive creation operations for this organization.
      const lock = await Organization.updateOne(
        {
          _id: organizationId,
          status: "active",
        },
        {
          $inc: { ownerGuardVersion: 1 },
        },
        { session },
      );

      if (lock.matchedCount !== 1) {
        throw createServiceError(
          404,
          "ORGANIZATION_NOT_FOUND",
          "Active organization not found",
        );
      }

      const subscription = await Subscription.findOne({
        organization: organizationId,
      })
        .populate({
          path: "plan",
          select: "entitlements.limits",
        })
        .session(session);

      if (!subscription?.plan) {
        throw createServiceError(
          404,
          "SUBSCRIPTION_NOT_FOUND",
          "Organization subscription or its plan was not found",
        );
      }

      const limits = subscription.plan.entitlements?.limits;
      const limit = getLimitValue(limits, resource);

      if (limit === undefined) {
        throw createServiceError(
          500,
          "SUBSCRIPTION_LIMIT_NOT_CONFIGURED",
          `The ${resource} limit is not configured for this plan`,
        );
      }

      if (limit !== null && (!Number.isSafeInteger(limit) || limit < 0)) {
        throw createServiceError(
          500,
          "INVALID_SUBSCRIPTION_LIMIT",
          `The ${resource} limit configuration is invalid`,
        );
      }

      const used = await getResourceUsage({
        organizationId,
        resource,
        session,
      });

      if (limit !== null && used >= limit) {
        throw createServiceError(
          403,
          "SUBSCRIPTION_LIMIT_REACHED",
          `Your subscription plan has reached its ${resource} limit`,
        );
      }

      result = await operation(session);
    });
  } finally {
    await session.endSession();
  }

  return result;
}
