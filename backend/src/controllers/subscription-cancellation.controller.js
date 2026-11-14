import {
  cancelOrganizationSubscription,
  resumeOrganizationSubscription,
} from "../services/subscription-cancellation.service.js";

export async function cancelOrganizationSubscriptionController(req, res, next) {
  try {
    const result = await cancelOrganizationSubscription({
      organizationId: req.organization.id,
    });

    return res.status(200).json({
      success: true,
      message: result.alreadyCancelled
        ? "Subscription cancellation is already scheduled"
        : "Subscription cancellation scheduled successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function resumeOrganizationSubscriptionController(req, res, next) {
  try {
    const result = await resumeOrganizationSubscription({
      organizationId: req.organization.id,
    });

    return res.status(200).json({
      success: true,
      message: "Subscription cancellation reversed successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}
