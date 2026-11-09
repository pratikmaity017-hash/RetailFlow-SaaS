import {
  createProductVariant,
  getProductVariants,
  getProductVariantById,
  updateProductVariant,
  deactivateProductVariant,
} from "../services/product-variant.service.js";

export async function createProductVariantController(req, res, next) {
  try {
    const variant = await createProductVariant({
      organizationId: req.organization.id,
      userId: req.auth.userId,
      variantData: {
        ...req.body,
        productId: req.params.productId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Product variant created successfully",
      data: { variant },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getProductVariantsController(req, res, next) {
  try {
    const variants = await getProductVariants({
      organizationId: req.organization.id,
      productId: req.params.productId,
    });

    return res.status(200).json({
      success: true,
      message: "Product variants retrieved successfully",
      data: { variants },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getProductVariantByIdController(req, res, next) {
  try {
    const variant = await getProductVariantById({
      organizationId: req.organization.id,
      productId: req.params.productId,
      variantId: req.params.variantId,
    });

    return res.status(200).json({
      success: true,
      message: "Product variant retrieved successfully",
      data: { variant },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateProductVariantController(req, res, next) {
  try {
    const variant = await updateProductVariant({
      organizationId: req.organization.id,
      productId: req.params.productId,
      variantId: req.params.variantId,
      userId: req.auth.userId,
      variantData: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Product variant updated successfully",
      data: { variant },
    });
  } catch (error) {
    return next(error);
  }
}

export async function deactivateProductVariantController(req, res, next) {
  try {
    const variant = await deactivateProductVariant({
      organizationId: req.organization.id,
      productId: req.params.productId,
      variantId: req.params.variantId,
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Product variant deactivated successfully",
      data: { variant },
    });
  } catch (error) {
    return next(error);
  }
}
