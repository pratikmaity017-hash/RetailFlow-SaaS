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
} from "../controllers/organization.controller.js";

import {
  createOrganizationSchema,
  updateOrganizationCategoriesSchema,
  updateOrganizationProfileSchema,
  updateOrganizationSettingsSchema,
  updateOrganizationMemberRoleSchema,
  updateOrganizationMemberStatusSchema,
  organizationMemberParamsSchema,
} from "../validators/organization.validator.js";

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

export default router;
