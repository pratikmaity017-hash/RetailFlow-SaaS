import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import {
  authorize,
  authorizeVariantStatusChange,
} from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";

import {
  createProductVariantSchema,
  updateProductVariantSchema,
} from "../validators/product-variant.validator.js";

import {
  createProductVariantController,
  getProductVariantsController,
  getProductVariantByIdController,
  updateProductVariantController,
  deactivateProductVariantController,
} from "../controllers/product-variant.controller.js";

const router = Router({ mergeParams: true });

// Create a variant for a product.
// Create a variant for a product.
router.post(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validate(createProductVariantSchema),
  createProductVariantController,
);

// Get all variants of a product.
router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  getProductVariantsController,
);

router.get(
  "/:variantId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  getProductVariantByIdController,
);

// Update a product variant.
router.put(
  "/:variantId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager"),
  validate(updateProductVariantSchema),
  authorizeVariantStatusChange,
  updateProductVariantController,
);

router.patch(
  "/:variantId/deactivate",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner"),
  deactivateProductVariantController,
);

export default router;
