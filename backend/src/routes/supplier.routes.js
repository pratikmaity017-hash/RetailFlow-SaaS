import { Router } from "express";

import {
  createSupplierController,
  listSuppliersController,
  getSupplierByIdController,
  updateSupplierController,
  updateSupplierStatusController,
} from "../controllers/supplier.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import {
  authorize,
  authorizeSupplierStatusChange,
} from "../middlewares/authorize.middleware.js";
import {
  validate,
  validateQuery,
  validateParams,
} from "../middlewares/validate.middleware.js";
import {
  createSupplierSchema,
  listSuppliersQuerySchema,
  supplierIdSchema,
  updateSupplierSchema,
  updateSupplierStatusSchema,
} from "../validators/supplier.validator.js";

const router = Router({ mergeParams: true });

const validateSupplierId = validateParams(supplierIdSchema, "supplierId");

router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  validateQuery(listSuppliersQuerySchema),
  listSuppliersController,
);

router.get(
  "/:supplierId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  validateSupplierId,
  getSupplierByIdController,
);

router.post(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validate(createSupplierSchema),
  createSupplierController,
);

router.patch(
  "/:supplierId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validateSupplierId,
  authorizeSupplierStatusChange,
  validate(updateSupplierSchema),
  updateSupplierController,
);

router.patch(
  "/:supplierId/status",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner"),
  validateSupplierId,
  validate(updateSupplierStatusSchema),
  updateSupplierStatusController,
);

export default router;
