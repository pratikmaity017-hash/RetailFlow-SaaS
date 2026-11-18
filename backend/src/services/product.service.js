import mongoose from "mongoose";
import { createServiceError } from "../utils/service-error.util.js";
import Product from "../models/product.model.js";
import { withSubscriptionLimit } from "./subscription-limit.service.js";
import { createAuditLog } from "./audit-log.service.js";

// Create a product inside the authenticated organization.
export async function createProduct({ organizationId, userId, productData }) {
  return withSubscriptionLimit({
    organizationId,
    resource: "products",

    operation: async (session) => {
      const [product] = await Product.create(
        [
          {
            ...productData,
            organization: organizationId,
            createdBy: userId,
          },
        ],
        { session },
      );

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "product.created",
        resourceType: "product",
        resourceId: product._id,
        description: "Product created successfully",
        metadata: {
          name: product.name,
          category: product.category,
          brand: product.brand,
          status: product.status,
        },
        session,
      });

      return product;
    },
  });
}

// Get products belonging only to the requested organization.
export async function getProducts({ organizationId, role }) {
  const filter = {
    organization: organizationId,
  };

  // Sales Staff can only see active products.
  if (role === "sales_staff") {
    filter.status = "active";
  }

  const products = await Product.find(filter).sort({
    createdAt: -1,
  });

  return products;
}

export async function getProductById({ organizationId, productId }) {
  const product = await Product.findOne({
    _id: productId,
    organization: organizationId,
  });

  if (!product) {
    throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  return product;
}

export async function updateProduct({
  organizationId,
  productId,
  userId,
  productData,
}) {
  const session = await mongoose.startSession();

  let updatedProduct;

  try {
    await session.withTransaction(async () => {
      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          organization: organizationId,
        },
        {
          $set: {
            ...productData,
            updatedBy: userId,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!product) {
        throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
      }

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "product.updated",
        resourceType: "product",
        resourceId: product._id,
        description: "Product updated successfully",
        metadata: {
          name: product.name,
          category: product.category,
          brand: product.brand,
          status: product.status,
        },
        session,
      });

      updatedProduct = product;
    });

    return updatedProduct;
  } finally {
    await session.endSession();
  }
}

export async function deactivateProduct({ organizationId, productId, userId }) {
  const session = await mongoose.startSession();

  let deactivatedProduct;

  try {
    await session.withTransaction(async () => {
      const product = await Product.findOneAndUpdate(
        {
          _id: productId,
          organization: organizationId,
          status: "active",
        },
        {
          $set: {
            status: "inactive",
            updatedBy: userId,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!product) {
        throw createServiceError(
          404,
          "PRODUCT_NOT_FOUND",
          "Active product not found",
        );
      }

      await createAuditLog({
        organizationId,
        actorId: userId,
        action: "product.deactivated",
        resourceType: "product",
        resourceId: product._id,
        description: "Product deactivated successfully",
        metadata: {
          name: product.name,
          previousStatus: "active",
          newStatus: product.status,
        },
        session,
      });

      deactivatedProduct = product;
    });

    return deactivatedProduct;
  } finally {
    await session.endSession();
  }
}
