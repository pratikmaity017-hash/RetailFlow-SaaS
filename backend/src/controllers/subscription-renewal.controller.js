import { createSubscriptionRenewal } from "../services/subscription-renewal.service.js";

export async function createSubscriptionRenewalController(req, res, next) {
  try {
    const result = await createSubscriptionRenewal({
      organizationId: req.organization.id,
      billingInterval: req.body.billingInterval,
    });

    return res.status(201).json({
      success: true,
      message: "Subscription renewal order created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
