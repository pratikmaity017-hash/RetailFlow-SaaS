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

const app = express();

const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5500"];

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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(healthRoute);
app.use("/api/auth", authRoutes);
app.use("/api/organizations", organizationRoutes);
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

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
