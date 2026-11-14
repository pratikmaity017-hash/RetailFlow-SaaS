import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireFeature } from "../middlewares/feature-entitlement.middleware.js";

import {
  createSaleSchema,
  cancelSaleSchema,
} from "../validators/sale.validator.js";

import {
  createSaleController,
  getSalesController,
  getSaleByIdController,
  cancelSaleController,
} from "../controllers/sale.controller.js";

const router = Router({ mergeParams: true });

router.post(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("sales_management"),
  authorize("owner", "manager", "sales_staff"),
  validate(createSaleSchema),
  createSaleController,
);

router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("sales_management"),
  authorize("owner", "manager", "sales_staff"),
  getSalesController,
);

router.patch(
  "/:saleId/cancel",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("sales_management"),
  authorize("owner", "manager"),
  validate(cancelSaleSchema),
  cancelSaleController,
);

router.get(
  "/:saleId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("sales_management"),
  authorize("owner", "manager", "sales_staff"),
  getSaleByIdController,
);

export default router;
