import { requestSubscriptionPlanChange } from "../services/subscription-change.service.js";

export async function requestSubscriptionPlanChangeController(req, res, next) {
  try {
    const result = await requestSubscriptionPlanChange({
      organizationId: req.organization.id,
      planCode: req.body.planCode,
      billingInterval: req.body.billingInterval,
    });

    return res.status(200).json({
      success: true,
      message: "Subscription plan change scheduled successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
