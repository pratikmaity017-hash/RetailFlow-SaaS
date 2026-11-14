import { createSubscriptionCheckout } from "../services/subscription-checkout.service.js";

export async function createSubscriptionCheckoutController(req, res, next) {
  try {
    const result = await createSubscriptionCheckout({
      organizationId: req.organization.id,
      planCode: req.body.planCode,
      billingInterval: req.body.billingInterval,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription checkout order created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
