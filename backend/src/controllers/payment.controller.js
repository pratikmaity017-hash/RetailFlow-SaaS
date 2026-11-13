import {
  createPayment,
  getSalePayments,
  getPaymentById,
} from "../services/payment.service.js";

export async function createPaymentController(req, res, next) {
  try {
    const result = await createPayment({
      organizationId: req.organization.id,
      saleId: req.params.saleId,
      userId: req.auth.userId,
      paymentData: req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: {
        payment: result.payment,
        sale: result.sale,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getSalePaymentsController(req, res, next) {
  try {
    const result = await getSalePayments({
      organizationId: req.organization.id,
      saleId: req.params.saleId,
      page: req.query.page,
      limit: req.query.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function getPaymentByIdController(req, res, next) {
  try {
    const payment = await getPaymentById({
      organizationId: req.organization.id,
      saleId: req.params.saleId,
      paymentId: req.params.paymentId,
    });

    return res.status(200).json({
      success: true,
      message: "Payment retrieved successfully",
      data: { payment },
    });
  } catch (error) {
    return next(error);
  }
}
