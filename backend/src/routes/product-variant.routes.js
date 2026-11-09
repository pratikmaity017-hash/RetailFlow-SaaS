import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";

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
router.post(
  "/",
  authenticate,
  requireOrganization,
  authorize("owner", "manager"),
  validate(createProductVariantSchema),
  createProductVariantController,
);

// Get all variants of a product.
router.get(
  "/",
  authenticate,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  getProductVariantsController,
);

router.get(
  "/:variantId",
  authenticate,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  getProductVariantByIdController,
);

router.put(
  "/:variantId",
  authenticate,
  requireOrganization,
  authorize("owner", "manager"),
  validate(updateProductVariantSchema),
  updateProductVariantController,
);

router.patch(
  "/:variantId/deactivate",
  authenticate,
  requireOrganization,
  authorize("owner"),
  deactivateProductVariantController,
);

export default router;
