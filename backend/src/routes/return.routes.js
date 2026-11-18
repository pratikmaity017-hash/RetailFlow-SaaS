import { Router } from "express";

import {
  createReturnController,
  approveReturnController,
  rejectReturnController,
} from "../controllers/return.controller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import {
  validate,
  validateParams,
} from "../middlewares/validate.middleware.js";
import { requireFeature } from "../middlewares/feature-entitlement.middleware.js";

import {
  createReturnSchema,
  processReturnSchema,
  returnIdSchema,
} from "../validators/return.validator.js";

const router = Router({ mergeParams: true });

const validateReturnId = validateParams(returnIdSchema, "returnId");

const returnAccess = [
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("returns_management"),
  authorize("owner", "manager"),
];

router.post(
  "/",
  ...returnAccess,
  validate(createReturnSchema),
  createReturnController,
);

router.patch(
  "/:returnId/approve",
  ...returnAccess,
  validateReturnId,
  validate(processReturnSchema),
  approveReturnController,
);

router.patch(
  "/:returnId/reject",
  ...returnAccess,
  validateReturnId,
  validate(processReturnSchema),
  rejectReturnController,
);

export default router;
