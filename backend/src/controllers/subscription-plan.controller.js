import { getAvailableSubscriptionPlans } from "../services/subscription-plan.service.js";

export async function getAvailableSubscriptionPlansController(req, res, next) {
  try {
    const result = await getAvailableSubscriptionPlans();

    return res.status(200).json({
      success: true,
      message: "Available subscription plans retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
