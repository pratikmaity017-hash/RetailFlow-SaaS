import {
  createOrganization,
  getUserOrganizations,
  updateOrganizationCategories,
  getOrganizationProfile,
  updateOrganizationProfile,
  getOrganizationSettings,
  updateOrganizationSettings,
  updateOrganizationMemberStatus,
  getOrganizationMembers,
  updateOrganizationMemberRole,
} from "../services/organization.service.js";

import { createOrganizationInvitation } from "../services/organization-invitation.service.js";
import { acceptOrganizationInvitation } from "../services/organization-invitation-acceptance.service.js";
import { revokeOrganizationInvitation } from "../services/organization-invitation-revocation.service.js";

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

export async function updateOrganizationMemberStatusController(req, res, next) {
  try {
    const result = await updateOrganizationMemberStatus({
      organizationId: req.organization.id,
      membershipId: req.params.membershipId,
      actorUserId: req.auth.userId,
      actorRole: req.membership.role,
      status: req.body.status,
    });

    return res.status(200).json({
      success: true,
      message: "Organization member status updated successfully",
      data: {
        member: result,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function getOrganizationMembersController(req, res, next) {
  try {
    const members = await getOrganizationMembers({
      organizationId: req.organization.id,
    });

    return res.status(200).json({
      success: true,
      message: "Organization members retrieved successfully",
      data: {
        members,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateOrganizationMemberRoleController(req, res, next) {
  try {
    const result = await updateOrganizationMemberRole({
      organizationId: req.organization.id,
      membershipId: req.params.membershipId,
      actorUserId: req.auth.userId,
      role: req.body.role,
    });

    return res.status(200).json({
      success: true,
      message: "Organization member role updated successfully",
      data: {
        member: result,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function createOrganizationInvitationController(req, res, next) {
  try {
    const invitation = await createOrganizationInvitation({
      organizationId: req.organization.id,
      actorUserId: req.auth.userId,
      actorRole: req.membership.role,
      email: req.body.email,
      role: req.body.role,
    });

    return res.status(201).json({
      success: true,
      message: "Organization invitation sent successfully",
      data: {
        invitation,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function acceptOrganizationInvitationController(req, res, next) {
  try {
    const result = await acceptOrganizationInvitation({
      userId: req.auth.userId,
      token: req.body.token,
    });

    return res.status(200).json({
      success: true,
      message: "Organization invitation accepted successfully",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
}

export async function revokeOrganizationInvitationController(req, res, next) {
  try {
    const invitation = await revokeOrganizationInvitation({
      organizationId: req.organization.id,
      invitationId: req.params.invitationId,
      actorRole: req.membership.role,
    });

    return res.status(200).json({
      success: true,
      message: "Organization invitation revoked successfully",
      data: {
        invitation,
      },
    });
  } catch (error) {
    return next(error);
  }
}
