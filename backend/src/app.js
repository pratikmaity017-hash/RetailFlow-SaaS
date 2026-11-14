import express from "express";
import cors from "cors";

import healthRoute from "./routes/health.route.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import notFoundMiddleware from "./middlewares/not-found.middleware.js";
import authRoutes from "./routes/auth.route.js";
import organizationRoutes from "./routes/organization.routes.js";
import productRoutes from "./routes/product.routes.js";
import productVariantRoutes from "./routes/product-variant.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import organizationInventoryRoutes from "./routes/organization-inventory.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import saleRoutes from "./routes/sale.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import businessCategoryRoutes from "./routes/business-category.routes.js";
import supplierRoutes from "./routes/supplier.routes.js";
import razorpayWebhookRoute from "./routes/razorpay-webhook.routes.js";

import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDirectory = path.resolve(__dirname, "../public");

app.use(express.urlencoded({ extended: true }));

app.use(express.static(publicDirectory));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header (e.g. server-side clients).
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  express.json({
    verify: (req, res, buffer) => {
      if (req.originalUrl.startsWith("/api/webhooks/razorpay")) {
        req.rawBody = Buffer.from(buffer);
      }
    },
  }),
);
app.use(express.urlencoded({ extended: true }));

app.use(healthRoute);
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/business-categories", businessCategoryRoutes);
app.use("/api/organizations/:organizationId/products", productRoutes);
app.use(
  "/api/organizations/:organizationId/products/:productId/variants",
  productVariantRoutes,
);

app.use(
  "/api/organizations/:organizationId/products/:productId/variants/:variantId/inventory",
  inventoryRoutes,
);

app.use(
  "/api/organizations/:organizationId/inventory",
  organizationInventoryRoutes,
);

app.use("/api/organizations/:organizationId/customers", customerRoutes);
app.use("/api/organizations/:organizationId/suppliers", supplierRoutes);
app.use("/api/organizations/:organizationId/sales", saleRoutes);
app.use(
  "/api/organizations/:organizationId/sales/:saleId/payments",
  paymentRoutes,
);

app.use("/api/webhooks/razorpay", razorpayWebhookRoute);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
