import {
  createOrganization,
  getUserOrganizations,
  updateOrganizationCategories,
  getOrganizationProfile,
  updateOrganizationProfile,
  getOrganizationSettings,
  updateOrganizationSettings,
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

export async function updateOrganizationCategoriesController(req, res, next) {
  try {
    const organization = await updateOrganizationCategories({
      organizationId: req.organization.id,
      primaryCategory: req.body.primaryCategory,
      additionalCategories: req.body.additionalCategories,
    });

    return res.status(200).json({
      success: true,
      message: "Organization categories updated successfully",
      data: {
        organization: {
          id: organization._id,
          name: organization.name,
          primaryCategory: organization.primaryCategory,
          additionalCategories: organization.additionalCategories,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getOrganizationProfileController(req, res, next) {
  try {
    const organization = await getOrganizationProfile({
      organizationId: req.organization.id,
    });

    return res.status(200).json({
      success: true,
      message: "Organization profile retrieved successfully",
      data: {
        organization,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateOrganizationProfileController(req, res, next) {
  try {
    const organization = await updateOrganizationProfile({
      organizationId: req.organization.id,
      ...req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Organization profile updated successfully",
      data: {
        organization,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getOrganizationSettingsController(req, res, next) {
  try {
    const settings = await getOrganizationSettings({
      organizationId: req.organization.id,
    });

    return res.status(200).json({
      success: true,
      message: "Organization settings retrieved successfully",
      data: {
        settings,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateOrganizationSettingsController(req, res, next) {
  try {
    const settings = await updateOrganizationSettings({
      organizationId: req.organization.id,
      settings: req.body,
    });

    return res.status(200).json({
      success: true,
      message: "Organization settings updated successfully",
      data: {
        settings,
      },
    });
  } catch (error) {
    return next(error);
  }
}
