import Product from "../models/product.model.js";
import ProductVariant from "../models/product-variant.model.js";
import { createServiceError } from "../utils/service-error.util.js";

export async function createProductVariant({
  organizationId,
  userId,
  variantData,
}) {
  const product = await Product.findOne({
    _id: variantData.productId,
    organization: organizationId,
    status: "active",
  }).select("_id");

  if (!product) {
    throw createServiceError(
      404,
      "PRODUCT_NOT_FOUND",
      "Active product not found",
    );
  }

  try {
    return await ProductVariant.create({
      organization: organizationId,
      product: product._id,
      sku: variantData.sku,
      barcode: variantData.barcode || null,
      attributes: variantData.attributes || {},
      costPrice: variantData.costPrice,
      sellingPrice: variantData.sellingPrice,
      createdBy: userId,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createServiceError(
        409,
        "VARIANT_IDENTIFIER_ALREADY_EXISTS",
        "This SKU or barcode is already used in your organization",
      );
    }

    throw error;
  }
}

export async function getProductVariants({ organizationId, productId }) {
  const product = await Product.findOne({
    _id: productId,
    organization: organizationId,
  }).select("_id");

  if (!product) {
    throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  return ProductVariant.find({
    organization: organizationId,
    product: product._id,
  }).sort({ createdAt: -1 });
}

export async function getProductVariantById({
  organizationId,
  productId,
  variantId,
}) {
  const product = await Product.findOne({
    _id: productId,
    organization: organizationId,
  }).select("_id");

  if (!product) {
    throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  const variant = await ProductVariant.findOne({
    _id: variantId,
    organization: organizationId,
    product: product._id,
  });

  if (!variant) {
    throw createServiceError(
      404,
      "VARIANT_NOT_FOUND",
      "Product variant not found",
    );
  }

  return variant;
}

export async function updateProductVariant({
  organizationId,
  productId,
  variantId,
  userId,
  variantData,
}) {
  const product = await Product.findOne({
    _id: productId,
    organization: organizationId,
  }).select("_id");

  if (!product) {
    throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  try {
    const updateData = { ...variantData };

    if (updateData.barcode !== undefined) {
      updateData.barcode = updateData.barcode || null;
    }

    const variant = await ProductVariant.findOneAndUpdate(
      {
        _id: variantId,
        organization: organizationId,
        product: product._id,
      },
      {
        $set: {
          ...updateData,
          updatedBy: userId,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!variant) {
      throw createServiceError(
        404,
        "VARIANT_NOT_FOUND",
        "Product variant not found",
      );
    }

    return variant;
  } catch (error) {
    if (error.code === 11000) {
      throw createServiceError(
        409,
        "VARIANT_IDENTIFIER_ALREADY_EXISTS",
        "This SKU or barcode is already used in your organization",
      );
    }

    throw error;
  }
}

export async function deactivateProductVariant({
  organizationId,
  productId,
  variantId,
  userId,
}) {
  const product = await Product.findOne({
    _id: productId,
    organization: organizationId,
  }).select("_id");

  if (!product) {
    throw createServiceError(404, "PRODUCT_NOT_FOUND", "Product not found");
  }

  const variant = await ProductVariant.findOneAndUpdate(
    {
      _id: variantId,
      organization: organizationId,
      product: product._id,
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

  if (!variant) {
    throw createServiceError(
      404,
      "VARIANT_NOT_FOUND",
      "Active product variant not found",
    );
  }

  return variant;
}
