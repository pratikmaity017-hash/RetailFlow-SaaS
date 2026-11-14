import { getOrganizationSubscription } from "../services/subscription.service.js";

export async function getOrganizationSubscriptionController(req, res, next) {
  try {
    const result = await getOrganizationSubscription({
      organizationId: req.organization.id,
    });

    return res.status(200).json({
      success: true,
      message: "Organization subscription retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
