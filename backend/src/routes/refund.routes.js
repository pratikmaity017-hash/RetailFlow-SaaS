import { Router } from "express";

import { processRefundController } from "../controllers/refund.controller.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import {
  validate,
  validateParams,
} from "../middlewares/validate.middleware.js";
import { requireFeature } from "../middlewares/feature-entitlement.middleware.js";

import { processRefundSchema } from "../validators/refund.validator.js";
import { returnIdSchema } from "../validators/return.validator.js";

const router = Router({ mergeParams: true });

const validateReturnId = validateParams(returnIdSchema, "returnId");

const refundAccess = [
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("returns_management"),
  authorize("owner", "manager"),
];

router.patch(
  "/:returnId/refund",
  ...refundAccess,
  validateReturnId,
  validate(processRefundSchema),
  processRefundController,
);

export default router;
