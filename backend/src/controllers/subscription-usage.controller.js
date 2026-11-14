import { getOrganizationSubscriptionUsage } from "../services/subscription-usage.service.js";

export async function getOrganizationSubscriptionUsageController(
  req,
  res,
  next,
) {
  try {
    const result = await getOrganizationSubscriptionUsage({
      organizationId: req.organization.id,
    });

    return res.status(200).json({
      success: true,
      message: "Subscription usage retrieved successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
