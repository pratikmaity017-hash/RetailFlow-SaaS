import OrganizationInvitation from "../models/organization-invitation.model.js";

import { createServiceError } from "../utils/service-error.util.js";

export async function revokeOrganizationInvitation({
  organizationId,
  invitationId,
  actorRole,
}) {
  if (!["owner", "manager"].includes(actorRole)) {
    throw createServiceError(
      403,
      "FORBIDDEN",
      "You are not allowed to revoke organization invitations",
    );
  }

  const invitation = await OrganizationInvitation.findOne({
    _id: invitationId,
    organization: organizationId,
  });

  if (!invitation) {
    throw createServiceError(
      404,
      "INVITATION_NOT_FOUND",
      "Organization invitation not found",
    );
  }

  if (invitation.status !== "pending") {
    throw createServiceError(
      409,
      "INVITATION_NOT_PENDING",
      "Only pending invitations can be revoked",
    );
  }

  // Managers can revoke only Sales Staff invitations.
  if (actorRole === "manager" && invitation.role !== "sales_staff") {
    throw createServiceError(
      403,
      "FORBIDDEN",
      "Managers can only revoke Sales Staff invitations",
    );
  }

  const now = new Date();

  // Mark expired invitations as expired instead of revoked.
  if (invitation.expiresAt <= now) {
    await OrganizationInvitation.updateOne(
      {
        _id: invitation._id,
        status: "pending",
      },
      {
        $set: {
          status: "expired",
        },
      },
    );

    throw createServiceError(
      410,
      "INVITATION_EXPIRED",
      "This invitation has expired",
    );
  }

  // Atomically revoke the pending invitation.
  const revokedInvitation = await OrganizationInvitation.findOneAndUpdate(
    {
      _id: invitation._id,
      organization: organizationId,
      status: "pending",
      expiresAt: { $gt: now },
    },
    {
      $set: {
        status: "revoked",
        revokedAt: now,
      },
    },
    {
      new: true,
    },
  );

  if (!revokedInvitation) {
    throw createServiceError(
      409,
      "INVITATION_NOT_PENDING",
      "This invitation has already been used or is no longer valid",
    );
  }

  return {
    invitationId: revokedInvitation._id.toString(),
    email: revokedInvitation.email,
    role: revokedInvitation.role,
    status: revokedInvitation.status,
    revokedAt: revokedInvitation.revokedAt,
  };
}
