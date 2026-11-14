import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { requireFeature } from "../middlewares/feature-entitlement.middleware.js";
import {
  authorize,
  authorizeProductStatusChange,
} from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../validators/product.validator.js";
import {
  createProductController,
  getProductsController,
  getProductByIdController,
  updateProductController,
  deactivateProductController,
} from "../controllers/product.controller.js";

const router = Router({ mergeParams: true });

// Create a product: Owner and Manager only
router.post(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("product_management"),
  authorize("owner", "manager"),
  validate(createProductSchema),
  createProductController,
);

// List products: All active organization members
router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("product_management"),
  authorize("owner", "manager", "sales_staff"),
  getProductsController,
);

// Get a single product
router.get(
  "/:productId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("product_management"),
  authorize("owner", "manager", "sales_staff"),
  getProductByIdController,
);

// Update a product
router.put(
  "/:productId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("product_management"),
  authorize("owner", "manager"),
  validate(updateProductSchema),
  authorizeProductStatusChange,
  updateProductController,
);

// Deactivate a product (soft delete)
router.delete(
  "/:productId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  requireFeature("product_management"),
  authorize("owner"),
  deactivateProductController,
);

export default router;
