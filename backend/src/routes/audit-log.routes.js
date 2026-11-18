import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validateQuery } from "../middlewares/validate.middleware.js";

import { auditLogQuerySchema } from "../validators/audit-log.validator.js";
import { listAuditLogsController } from "../controllers/audit-log.controller.js";

const router = Router({ mergeParams: true });

router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validateQuery(auditLogQuerySchema),
  listAuditLogsController,
);

export default router;
