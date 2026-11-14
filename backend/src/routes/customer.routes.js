import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import {
  authorize,
  authorizeCustomerStatusChange,
} from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import { requireFeature } from "../middlewares/feature-entitlement.middleware.js";

import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../validators/customer.validator.js";

import {
  createCustomerController,
  getCustomersController,
  getCustomerByIdController,
  updateCustomerController,
  deactivateCustomerController,
} from "../controllers/customer.controller.js";

const router = Router({ mergeParams: true });

// Create customer: Owner and Manager only
router.post(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("customer_management"),
  authorize("owner", "manager"),
  validate(createCustomerSchema),
  createCustomerController,
);

// List customers: All active organization members
router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("customer_management"),
  authorize("owner", "manager", "sales_staff"),
  getCustomersController,
);

// Get a single customer
router.get(
  "/:customerId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("customer_management"),
  authorize("owner", "manager", "sales_staff"),
  getCustomerByIdController,
);

// Update customer: Owner and Manager only
router.put(
  "/:customerId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("customer_management"),
  authorize("owner", "manager"),
  validate(updateCustomerSchema),
  authorizeCustomerStatusChange,
  updateCustomerController,
);

// Deactivate customer: Owner only
router.delete(
  "/:customerId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("customer_management"),
  authorize("owner"),
  deactivateCustomerController,
);

export default router;
