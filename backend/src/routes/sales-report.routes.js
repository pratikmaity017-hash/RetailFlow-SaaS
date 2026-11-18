import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { requireFeature } from "../middlewares/feature-entitlement.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validateQuery } from "../middlewares/validate.middleware.js";

import { salesReportQuerySchema } from "../validators/sales-report.validator.js";
import { getSalesReportController } from "../controllers/sales-report.controller.js";

const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("sales_management"),
  authorize("owner", "manager"),
  validateQuery(salesReportQuerySchema),
  getSalesReportController,
);

export default router;
