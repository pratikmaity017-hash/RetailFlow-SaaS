import { Router } from "express";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { requireOrganization } from "../middlewares/organization.middleware.js";
import { authorize } from "../middlewares/authorize.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { requireEmailVerified } from "../middlewares/require-email-verified.middleware.js";

import { createPaymentSchema } from "../validators/payment.validator.js";

import {
  createPaymentController,
  getSalePaymentsController,
  getPaymentByIdController,
} from "../controllers/payment.controller.js";

const router = Router({ mergeParams: true });

router.post(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  validate(createPaymentSchema),
  createPaymentController,
);

router.get(
  "/",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  getSalePaymentsController,
);

router.get(
  "/:paymentId",
  authenticate,
  requireEmailVerified,
  requireOrganization,
  authorize("owner", "manager", "sales_staff"),
  getPaymentByIdController,
);

export default router;
