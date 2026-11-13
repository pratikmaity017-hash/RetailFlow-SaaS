import {
  createOrganization,
  getUserOrganizations,
} from "../services/organization.service.js";

export async function createOrganizationController(req, res, next) {
  try {
    const result = await createOrganization({
      userId: req.auth.userId,
      name: req.body.name,
    });

    return res.status(201).json({
      success: true,
      message: "Organization created successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

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
