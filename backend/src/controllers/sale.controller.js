import { createSale, getSales, getSaleById ,cancelSale } from "../services/sale.service.js";

export async function createSaleController(req, res, next) {
  try {
    const result = await createSale({
      organizationId: req.organization.id,
      userId: req.auth.userId,
      saleData: req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: {
        sale: result.sale,
        items: result.items,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getSalesController(req, res, next) {
  try {
    const result = await getSales({
      organizationId: req.organization.id,
      status: req.query.status,
      paymentStatus: req.query.paymentStatus,
      customerId: req.query.customerId,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Sales retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getSaleByIdController(req, res, next) {
  try {
    const result = await getSaleById({
      organizationId: req.organization.id,
      saleId: req.params.saleId,
    });

    return res.status(200).json({
      success: true,
      message: "Sale retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export const cancelSaleController = async (req, res, next) => {
  try {
    const result = await cancelSale({
      organizationId: req.organization.id,
      saleId: req.params.saleId,
      userId: req.auth.userId,
      reason: req.body.reason,
    });

    return res.status(200).json({
      success: true,
      message: "Sale cancelled successfully",
      data: {
        sale: result.sale,
        restoredItems: result.restoredItems,
      },
    });
  } catch (error) {
    next(error);
  }
};
