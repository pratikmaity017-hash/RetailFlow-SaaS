import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import {
  authorize,
  authorizeProductStatusChange,
} from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
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
  requireOrganization,
  authorize("owner", "manager"),
  validate(createProductSchema),
  createProductController,
);

// List products: All active organization members
router.get(
  "/",
  authenticate,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  getProductsController,
);

// Get a single product
router.get(
  "/:productId",
  authenticate,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  getProductByIdController,
);

// Update a product

router.put(
  "/:productId",
  authenticate,
  requireOrganization,
  authorize("owner", "manager"),
  validate(updateProductSchema),
  authorizeProductStatusChange,
  updateProductController,
);
// Deactivate a product (soft delete)
router.delete(
  "/:productId",
  authenticate,
  requireOrganization,
  authorize("owner"),
  deactivateProductController,
);

export default router;
