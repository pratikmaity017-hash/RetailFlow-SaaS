import { Router } from "express";

import { authenticateAdvancedService } from "../middlewares/authenticate-advanced-service.middleware.js";
import { validateQuery } from "../middlewares/validate.middleware.js";

import { internalProfitReportingQuerySchema } from "../validators/internal-profit-reporting.validator.js";
import { getInternalProfitReportingController } from "../controllers/internal-profit-reporting.controller.js";

const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticateAdvancedService,
  validateQuery(internalProfitReportingQuerySchema),
  getInternalProfitReportingController,
);

export default router;
