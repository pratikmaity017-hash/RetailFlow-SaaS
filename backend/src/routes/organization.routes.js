import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import {
  validate,
  validateParams,
} from "../middlewares/validate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";

import {
  createOrganizationController,
  getUserOrganizationsController,
  updateOrganizationCategoriesController,
  getOrganizationProfileController,
  updateOrganizationProfileController,
  getOrganizationSettingsController,
  updateOrganizationSettingsController,
  getOrganizationMembersController,
  updateOrganizationMemberRoleController,
  updateOrganizationMemberStatusController,
  createOrganizationInvitationController,
  acceptOrganizationInvitationController,
  revokeOrganizationInvitationController,
} from "../controllers/organization.controller.js";

import { getOrganizationSubscriptionController } from "../controllers/subscription.controller.js";
import { getAvailableSubscriptionPlansController } from "../controllers/subscription-plan.controller.js";
import { getOrganizationSubscriptionUsageController } from "../controllers/subscription-usage.controller.js";
import { requestSubscriptionPlanChangeController } from "../controllers/subscription-change.controller.js";
import { createSubscriptionCheckoutController } from "../controllers/subscription-checkout.controller.js";
import {
  verifySubscriptionPaymentController,
  recoverSubscriptionPaymentController,
} from "../controllers/subscription-payment.controller.js";

import {
  verifySubscriptionPaymentSchema,
  subscriptionPaymentParamsSchema,
  recoverSubscriptionPaymentSchema,
} from "../validators/subscription-payment.validator.js";

import {
  createOrganizationSchema,
  updateOrganizationCategoriesSchema,
  updateOrganizationProfileSchema,
  updateOrganizationSettingsSchema,
  updateOrganizationMemberRoleSchema,
  updateOrganizationMemberStatusSchema,
  organizationMemberParamsSchema,
  createOrganizationInvitationSchema,
  acceptOrganizationInvitationSchema,
  organizationInvitationParamsSchema,
} from "../validators/organization.validator.js";

import {
  requestSubscriptionPlanChangeSchema,
  subscriptionChangeParamsSchema,
} from "../validators/subscription-change.validator.js";
import {
  createSubscriptionCheckoutSchema,
  subscriptionCheckoutParamsSchema,
} from "../validators/subscription-checkout.validator.js";

const router = Router();

// Create an organization and become its owner.
router.post(
  "/",
  authenticate,
  requireEmailVerified,
  validate(createOrganizationSchema),
  createOrganizationController,
);

// Get all active organizations belonging to the authenticated user.
router.get(
  "/",
  authenticate,
  requireEmailVerified,
  getUserOrganizationsController,
);

router.get(
  "/:organizationId/context",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Organization access verified",
      data: {
        organization: req.organization,
        membership: req.membership,
      },
    });
  },
);

router.get(
  "/:organizationId/owner-only",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner"),
  (req, res) => {
    return res.status(200).json({
      success: true,
      message: "Owner permission verified",
      data: {
        userId: req.auth.userId,
        organizationId: req.organization.id,
        role: req.membership.role,
      },
    });
  },
);

router.patch(
  "/:organizationId/categories",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validate(updateOrganizationCategoriesSchema),
  updateOrganizationCategoriesController,
);

// Get organization profile.
router.get(
  "/:organizationId/profile",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  getOrganizationProfileController,
);

// Update organization profile.
router.patch(
  "/:organizationId/profile",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validate(updateOrganizationProfileSchema),
  updateOrganizationProfileController,
);

// Get organization settings.
router.get(
  "/:organizationId/settings",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  getOrganizationSettingsController,
);

// Update organization settings.
router.patch(
  "/:organizationId/settings",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validate(updateOrganizationSettingsSchema),
  updateOrganizationSettingsController,
);

// Get all organization members.
router.get(
  "/:organizationId/members",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  getOrganizationMembersController,
);

router.post(
  "/:organizationId/invitations",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validate(createOrganizationInvitationSchema),
  createOrganizationInvitationController,
);

router.post(
  "/invitations/accept",
  authenticate,
  requireEmailVerified,
  validate(acceptOrganizationInvitationSchema),
  acceptOrganizationInvitationController,
);

// Update an organization member's role (Owner only).
router.patch(
  "/:organizationId/members/:membershipId/role",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner"),
  validateParams(organizationMemberParamsSchema),
  validate(updateOrganizationMemberRoleSchema),
  updateOrganizationMemberRoleController,
);

// Update an organization member's status (Owner and Manager).
router.patch(
  "/:organizationId/members/:membershipId/status",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validateParams(organizationMemberParamsSchema),
  validate(updateOrganizationMemberStatusSchema),
  updateOrganizationMemberStatusController,
);

router.delete(
  "/:organizationId/invitations/:invitationId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validateParams(organizationInvitationParamsSchema),
  revokeOrganizationInvitationController,
);

router.get(
  "/:organizationId/subscription",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  getOrganizationSubscriptionController,
);

router.get(
  "/:organizationId/subscription/plans",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  getAvailableSubscriptionPlansController,
);

router.get(
  "/:organizationId/subscription/usage",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  getOrganizationSubscriptionUsageController,
);

router.post(
  "/:organizationId/subscription/change",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner"),
  validateParams(subscriptionChangeParamsSchema),
  validate(requestSubscriptionPlanChangeSchema),
  requestSubscriptionPlanChangeController,
);

// Create a Razorpay checkout order for upgrading from Free to Paid.
router.post(
  "/:organizationId/subscription/checkout",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner"),
  validateParams(subscriptionCheckoutParamsSchema),
  validate(createSubscriptionCheckoutSchema),
  createSubscriptionCheckoutController,
);

router.post(
  "/:organizationId/subscription/verify-payment",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner"),
  validateParams(subscriptionPaymentParamsSchema),
  validate(verifySubscriptionPaymentSchema),
  verifySubscriptionPaymentController,
);

router.post(
  "/:organizationId/subscription/recover-payment",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner"),
  validateParams(subscriptionPaymentParamsSchema),
  validate(recoverSubscriptionPaymentSchema),
  recoverSubscriptionPaymentController,
);

export default router;
