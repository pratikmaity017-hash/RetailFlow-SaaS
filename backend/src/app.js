import express from "express";
import healthRoute from "./routes/health.route.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import notFoundMiddleware from "./middlewares/not-found.middleware.js";
import authRoutes from "./routes/auth.route.js";
import organizationRoutes from "./routes/organization.routes.js";
import productRoutes from "./routes/product.routes.js";
import productVariantRoutes from "./routes/product-variant.routes.js";

const app = express();

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
app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
