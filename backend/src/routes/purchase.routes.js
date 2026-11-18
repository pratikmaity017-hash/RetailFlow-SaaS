import { Router } from "express";

import {
  createPurchaseController,
  orderPurchaseController,
  receivePurchaseController,
  cancelPurchaseController,
} from "../controllers/purchase.controller.js";

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
  createPurchaseSchema,
  receivePurchaseSchema,
  cancelPurchaseSchema,
  purchaseIdSchema,
} from "../validators/purchase.validator.js";

const router = Router({ mergeParams: true });

const validatePurchaseId = validateParams(purchaseIdSchema, "purchaseId");

const purchaseAccess = [
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("purchase_management"),
  authorize("owner", "manager"),
];

router.post(
  "/",
  ...purchaseAccess,
  validate(createPurchaseSchema),
  createPurchaseController,
);

router.patch(
  "/:purchaseId/order",
  ...purchaseAccess,
  validatePurchaseId,
  orderPurchaseController,
);

router.patch(
  "/:purchaseId/receive",
  ...purchaseAccess,
  validatePurchaseId,
  validate(receivePurchaseSchema),
  receivePurchaseController,
);

router.patch(
  "/:purchaseId/cancel",
  ...purchaseAccess,
  validatePurchaseId,
  validate(cancelPurchaseSchema),
  cancelPurchaseController,
);

export default router;
