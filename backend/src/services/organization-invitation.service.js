import Organization from "../models/organization.model.js";
import OrganizationInvitation from "../models/organization-invitation.model.js";
import Membership from "../models/membership.model.js";
import User from "../models/user.model.js";

import { env } from "../config/env.js";
import { createServiceError } from "../utils/service-error.util.js";
import {
  generateOrganizationInvitationToken,
  hashOrganizationInvitationToken,
} from "../utils/organization-invitation-token.js";
import { sendEmail } from "./email.service.js";
import { createOrganizationInvitationTemplate } from "../templates/organization-invitation.template.js";

const INVITATION_EXPIRY_DAYS = 7;

export async function createOrganizationInvitation({
  organizationId,
  actorUserId,
  actorRole,
  email,
  role,
}) {
  // Validate the actor's organization permissions.
  if (!["owner", "manager"].includes(actorRole)) {
    throw createServiceError(
      403,
      "INSUFFICIENT_PERMISSIONS",
      "You do not have permission to invite organization members",
    );
  }

  if (!["manager", "sales_staff"].includes(role)) {
    throw createServiceError(
      400,
      "INVALID_INVITATION_ROLE",
      "Invitations can only be created for Manager or Sales Staff roles",
    );
  }

  if (actorRole === "manager" && role !== "sales_staff") {
    throw createServiceError(
      403,
      "INSUFFICIENT_PERMISSIONS",
      "Managers can only invite Sales Staff members",
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Verify that the organization is active.
  const organization = await Organization.findOne({
    _id: organizationId,
    status: "active",
  })
    .select("name")
    .lean();

  if (!organization) {
    throw createServiceError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Active organization not found",
    );
  }

  // Find the actor and prevent self-invitation.
  const actor = await User.findById(actorUserId).select("email").lean();

  if (!actor) {
    throw createServiceError(404, "ACTOR_NOT_FOUND", "Inviting user not found");
  }

  if (actor.email.toLowerCase() === normalizedEmail) {
    throw createServiceError(
      400,
      "SELF_INVITATION_NOT_ALLOWED",
      "You cannot invite yourself",
    );
  }

  // Check whether the invited email already belongs to an account.
  const invitedUser = await User.findOne({
    email: normalizedEmail,
  })
    .select("name email status")
    .lean();

  if (invitedUser && invitedUser.status !== "active") {
    throw createServiceError(
      403,
      "ACCOUNT_NOT_ACTIVE",
      "This email belongs to an inactive account",
    );
  }

  // Prevent existing organization members from receiving invitations.
  if (invitedUser) {
    const existingMembership = await Membership.findOne({
      organization: organizationId,
      user: invitedUser._id,
    })
      .select("_id status")
      .lean();

    if (existingMembership) {
      throw createServiceError(
        409,
        "USER_ALREADY_ORGANIZATION_MEMBER",
        "This user already has a membership in the organization",
      );
    }
  }

  // Expire old pending invitations before checking for duplicates.
  const now = new Date();

  await OrganizationInvitation.updateMany(
    {
      organization: organizationId,
      email: normalizedEmail,
      status: "pending",
      expiresAt: { $lte: now },
    },
    {
      $set: { status: "expired" },
    },
  );

  const existingInvitation = await OrganizationInvitation.findOne({
    organization: organizationId,
    email: normalizedEmail,
    status: "pending",
  })
    .select("_id")
    .lean();

  if (existingInvitation) {
    throw createServiceError(
      409,
      "INVITATION_ALREADY_PENDING",
      "A pending invitation already exists for this email",
    );
  }

  // Generate a secure token and store only its hash.
  const rawToken = generateOrganizationInvitationToken();
  const tokenHash = hashOrganizationInvitationToken(rawToken);

  const expiresAt = new Date(
    now.getTime() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  );

  let invitation;

  try {
    invitation = await OrganizationInvitation.create({
      organization: organizationId,
      email: normalizedEmail,
      role,
      invitedBy: actorUserId,
      tokenHash,
      expiresAt,
    });
  } catch (error) {
    // Handle duplicate invitations caused by concurrent requests.
    if (error.code === 11000) {
      throw createServiceError(
        409,
        "INVITATION_ALREADY_PENDING",
        "A pending invitation already exists for this email",
      );
    }

    throw error;
  }

  // Build the frontend invitation URL.
  const invitationUrl = new URL("/accept-invitation", env.FRONTEND_URL);

  invitationUrl.searchParams.set("token", rawToken);

  const emailContent = createOrganizationInvitationTemplate({
    name: invitedUser?.name || "there",
    organizationName: organization.name,
    role,
    invitationUrl: invitationUrl.toString(),
  });

  // Send the invitation email.
  try {
    await sendEmail({
      to: normalizedEmail,
      ...emailContent,
    });
  } catch (error) {
    // Do not leave an unusable pending invitation if email delivery fails.
    await OrganizationInvitation.updateOne(
      {
        _id: invitation._id,
        status: "pending",
      },
      {
        $set: {
          status: "revoked",
          revokedAt: new Date(),
        },
      },
    );

    throw createServiceError(
      503,
      "INVITATION_EMAIL_DELIVERY_FAILED",
      "The invitation could not be delivered. Please try again later",
    );
  }

  return {
    invitationId: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
  };
}
