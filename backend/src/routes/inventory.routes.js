import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireFeature } from "../middlewares/feature-entitlement.middleware.js";

import { stockAdjustmentSchema } from "../validators/inventory.validator.js";
import {
  adjustStockController,
  getInventoryController,
  getStockMovementsController,
} from "../controllers/inventory.controller.js";

const router = Router({ mergeParams: true });

router.post(
  "/adjustments",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("inventory_management"),
  authorize("owner", "manager"),
  validate(stockAdjustmentSchema),
  adjustStockController,
);

router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("inventory_management"),
  getInventoryController,
);

router.get(
  "/movements",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("inventory_management"),
  getStockMovementsController,
);

export default router;
