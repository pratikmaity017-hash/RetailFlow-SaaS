import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";

import { getLowStockInventoryController } from "../controllers/inventory.controller.js";

const router = Router({ mergeParams: true });

router.get(
  "/low-stock",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  getLowStockInventoryController,
);

export default router;
