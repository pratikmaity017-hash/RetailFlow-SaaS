import { createServiceError } from "../utils/service-error.util.js";
import Product from "../models/product.model.js";

// Create a product inside the authenticated organization.
export async function createProduct({ organizationId, userId, productData }) {
  const product = await Product.create({
    ...productData,
    organization: organizationId,
    createdBy: userId,
  });

  return product;
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
    },
  );

  if (!product) {
    throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  return product;
}

export async function deactivateProduct({ organizationId, productId, userId }) {
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
    },
  );

  if (!product) {
    throw createServiceError(
      404,
      "PRODUCT_NOT_FOUND",
      "Active product not found",
    );
  }

  return product;
}
