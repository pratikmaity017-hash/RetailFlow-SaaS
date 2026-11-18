import { processRefund } from "../services/refund.service.js";

export async function processRefundController(req, res, next) {
  try {
    const result = await processRefund({
      organizationId: req.organization.id,
      returnId: req.params.returnId,
      userId: req.auth.userId,
      refundData: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Refund recorded successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
