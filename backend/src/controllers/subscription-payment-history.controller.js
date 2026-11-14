import { getSubscriptionPaymentHistory } from "../services/subscription-payment-history.service.js";

export async function getSubscriptionPaymentHistoryController(req, res, next) {
  try {
    const result = await getSubscriptionPaymentHistory({
      organizationId: req.organization.id,
      page: req.validatedQuery.page,
      limit: req.validatedQuery.limit,
    });

    return res.status(200).json({
      success: true,
      message: "Subscription payment history retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
