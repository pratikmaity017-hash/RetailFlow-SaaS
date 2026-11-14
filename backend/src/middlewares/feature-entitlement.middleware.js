import Organization from "../models/organization.model.js";
import Feature from "../models/feature.model.js";
import BusinessCategoryFeature from "../models/business-category-feature.model.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";
import { createServiceError } from "../utils/service-error.util.js";

export function requireFeature(featureCode) {
  return async (req, res, next) => {
    try {
      // 1. Organization context is required.
      if (!req.organization?.id) {
        throw createServiceError(
          403,
          "ORGANIZATION_CONTEXT_REQUIRED",
          "Organization context is required",
        );
      }

      // 2. Check whether the requested feature exists and is active.
      const feature = await Feature.findOne({
        code: featureCode,
        status: "active",
      }).select("_id code");

      if (!feature) {
        throw createServiceError(
          404,
          "FEATURE_NOT_FOUND",
          "Requested feature is unavailable",
        );
      }

      // 3. Load the organization's business categories.
      const organization = await Organization.findOne({
        _id: req.organization.id,
        status: "active",
      }).select("primaryCategory additionalCategories");

      if (!organization) {
        throw createServiceError(
          404,
          "ORGANIZATION_NOT_FOUND",
          "Organization not found or unavailable",
        );
      }

      const categoryIds = [
        organization.primaryCategory,
        ...organization.additionalCategories,
      ].filter(Boolean);

      if (categoryIds.length === 0) {
        throw createServiceError(
          403,
          "BUSINESS_CATEGORY_REQUIRED",
          "Organization does not have a business category",
        );
      }

      // 4. Check whether at least one category supports this feature.
      const categoryFeature = await BusinessCategoryFeature.findOne({
        businessCategory: { $in: categoryIds },
        feature: feature._id,
        status: "active",
      }).select("_id");

      if (!categoryFeature) {
        throw createServiceError(
          403,
          "FEATURE_NOT_SUPPORTED",
          "This feature is not supported by your business category",
        );
      }

      // 5. Load the organization's subscription and its plan.
      const subscription = await Subscription.findOne({
        organization: organization._id,
      }).populate("plan");

      if (!subscription || !subscription.plan) {
        throw createServiceError(
          403,
          "SUBSCRIPTION_REQUIRED",
          "An active subscription is required",
        );
      }

      // 6. Check subscription status and grace period.
      const isActive = subscription.status === "active";

      const isWithinGracePeriod =
        subscription.status === "past_due" &&
        subscription.gracePeriodEndsAt &&
        subscription.gracePeriodEndsAt > new Date();

      if (!isActive && !isWithinGracePeriod) {
        throw createServiceError(
          403,
          "SUBSCRIPTION_INACTIVE",
          "Your subscription is inactive or its grace period has ended",
        );
      }

      // 7. Check whether the subscription plan is active.
      if (!subscription.plan.isActive) {
        throw createServiceError(
          403,
          "SUBSCRIPTION_PLAN_UNAVAILABLE",
          "Your subscription plan is unavailable",
        );
      }

      // 8. Check whether the plan unlocks this feature.
      const features = subscription.plan.entitlements?.features;

      const isFeatureEnabled =
        features instanceof Map
          ? features.get(featureCode) === true
          : features?.[featureCode] === true;

      if (!isFeatureEnabled) {
        throw createServiceError(
          403,
          "FEATURE_NOT_INCLUDED_IN_PLAN",
          "Your subscription plan does not include this feature",
        );
      }

      // 9. Attach verified feature context.
      req.feature = {
        id: feature._id.toString(),
        code: feature.code,
      };

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
