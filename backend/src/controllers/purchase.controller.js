import {
  createPurchase,
  orderPurchase,
  receivePurchase,
  cancelPurchase,
} from "../services/purchase.service.js";

export async function createPurchaseController(req, res, next) {
  try {
    const result = await createPurchase({
      organizationId: req.organization.id,
      userId: req.auth.userId,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function orderPurchaseController(req, res, next) {
  try {
    const purchase = await orderPurchase({
      organizationId: req.organization.id,
      purchaseId: req.params.purchaseId,
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase ordered successfully",
      data: {
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function receivePurchaseController(req, res, next) {
  try {
    const result = await receivePurchase({
      organizationId: req.organization.id,
      purchaseId: req.params.purchaseId,
      userId: req.auth.userId,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase items received successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelPurchaseController(req, res, next) {
  try {
    const purchase = await cancelPurchase({
      organizationId: req.organization.id,
      purchaseId: req.params.purchaseId,
      userId: req.auth.userId,
      cancellationReason: req.body.cancellationReason,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase cancelled successfully",
      data: {
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
}
