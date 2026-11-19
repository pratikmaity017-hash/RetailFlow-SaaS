import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireFeature } from "../middlewares/feature-entitlement.middleware.js";
import { validateQuery } from "../middlewares/validate.middleware.js";

import { inventoryPaginationQuerySchema } from "../validators/inventory.validator.js";

import { getLowStockInventoryController } from "../controllers/inventory.controller.js";

const router = Router({ mergeParams: true });

router.get(
  "/low-stock",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("inventory_management"),
  validateQuery(inventoryPaginationQuerySchema),
  getLowStockInventoryController,
);

export default router;
