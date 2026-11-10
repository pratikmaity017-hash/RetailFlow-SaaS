import { getUserOrganizations } from "../services/organization.service.js";

export async function getUserOrganizationsController(req, res, next) {
  try {
    const organizations = await getUserOrganizations({
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Organizations retrieved successfully",
      data: {
        organizations,
      },
    });
  } catch (error) {
    return next(error);
  }
}
