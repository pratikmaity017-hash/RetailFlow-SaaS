import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deactivateProduct,
} from "../services/product.service.js";

export async function createProductController(req, res, next) {
  try {
    const product = await createProduct({
      organizationId: req.organization.id,
      userId: req.auth.userId,
      productData: req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductsController(req, res, next) {
  try {
    const products = await getProducts({
      organizationId: req.organization.id,
      role: req.membership.role,
    });

    return res.status(200).json({
      success: true,
      message: "Products retrieved successfully",
      data: {
        products,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductByIdController(req, res, next) {
  try {
    const product = await getProductById({
      organizationId: req.organization.id,
      productId: req.params.productId,
    });

    return res.status(200).json({
      success: true,
      message: "Product retrieved successfully",
      data: { product },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateProductController(req, res, next) {
  try {
    const product = await updateProduct({
      organizationId: req.organization.id,
      productId: req.params.productId,
      userId: req.auth.userId,
      productData: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: { product },
    });
  } catch (error) {
    return next(error);
  }
}

export async function deactivateProductController(req, res, next) {
  try {
    const product = await deactivateProduct({
      organizationId: req.organization.id,
      productId: req.params.productId,
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Product deactivated successfully",
      data: { product },
    });
  } catch (error) {
    return next(error);
  }
}
