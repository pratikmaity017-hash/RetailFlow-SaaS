import {
  verifySubscriptionPayment,
  recoverSubscriptionPayment,
} from "../services/subscription-payment.service.js";

export async function verifySubscriptionPaymentController(req, res, next) {
  try {
    const result = await verifySubscriptionPayment({
      organizationId: req.organization.id,
      orderId: req.body.orderId,
      paymentId: req.body.paymentId,
      signature: req.body.signature,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyVerified
        ? "Payment was already verified"
        : "Subscription payment verified successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function recoverSubscriptionPaymentController(req, res, next) {
  try {
    const result = await recoverSubscriptionPayment({
      organizationId: req.organization.id,
      orderId: req.body.orderId,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyVerified
        ? "Payment was already recovered"
        : "Subscription payment recovered successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
