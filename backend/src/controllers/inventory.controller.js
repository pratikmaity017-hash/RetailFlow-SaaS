import {
  adjustStock,
  getInventory,
  getStockMovements,
  getLowStockInventory,
} from "../services/inventory.service.js";

export async function adjustStockController(req, res, next) {
  try {
    const result = await adjustStock({
      organizationId: req.organization.id,
      productId: req.params.productId,
      variantId: req.params.variantId,
      userId: req.auth.userId,
      adjustmentData: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Stock adjusted successfully",
      data: {
        inventory: result.inventory,
        movement: result.movement,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getInventoryController(req, res, next) {
  try {
    const result = await getInventory({
      organizationId: req.organization.id,
      productId: req.params.productId,
      variantId: req.params.variantId,
    });

    return res.status(200).json({
      success: true,
      message: "Inventory retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getStockMovementsController(req, res, next) {
  try {
    const result = await getStockMovements({
      organizationId: req.organization.id,
      productId: req.params.productId,
      variantId: req.params.variantId,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Stock movement history retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getLowStockInventoryController(req, res, next) {
  try {
    const result = await getLowStockInventory({
      organizationId: req.organization.id,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Low-stock inventory retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
