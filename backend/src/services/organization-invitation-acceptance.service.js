import mongoose from "mongoose";

import Organization from "../models/organization.model.js";
import OrganizationInvitation from "../models/organization-invitation.model.js";
import Membership from "../models/membership.model.js";
import User from "../models/user.model.js";

import { createServiceError } from "../utils/service-error.util.js";
import { hashOrganizationInvitationToken } from "../utils/organization-invitation-token.js";

export async function acceptOrganizationInvitation({ userId, token }) {
  const tokenHash = hashOrganizationInvitationToken(token);
  const session = await mongoose.startSession();

  let result;
  let acceptanceError;

  try {
    await session.withTransaction(async () => {
      const now = new Date();

      // Find the invitation using its hashed token.
      const invitation = await OrganizationInvitation.findOne({
        tokenHash,
      }).session(session);

      if (!invitation) {
        throw createServiceError(
          404,
          "INVALID_INVITATION",
          "Invitation not found or token is invalid",
        );
      }

      if (invitation.status !== "pending") {
        throw createServiceError(
          409,
          "INVITATION_NOT_PENDING",
          "This invitation is no longer pending",
        );
      }

      // Mark expired invitations as expired.
      if (invitation.expiresAt <= now) {
        await OrganizationInvitation.updateOne(
          {
            _id: invitation._id,
            status: "pending",
          },
          {
            $set: { status: "expired" },
          },
          { session },
        );

        // Return from the transaction so the expiry update commits.
        acceptanceError = createServiceError(
          410,
          "INVITATION_EXPIRED",
          "This invitation has expired",
        );

        return;
      }

      // Load the authenticated user.
      const user = await User.findById(userId)
        .select("email status emailVerifiedAt")
        .session(session);

      if (!user) {
        throw createServiceError(
          404,
          "USER_NOT_FOUND",
          "User account not found",
        );
      }

      if (user.status !== "active") {
        throw createServiceError(
          403,
          "ACCOUNT_NOT_ACTIVE",
          "Your account is not active",
        );
      }

      if (!user.emailVerifiedAt) {
        throw createServiceError(
          403,
          "EMAIL_NOT_VERIFIED",
          "Verify your email before accepting an invitation",
        );
      }

      // The authenticated user's email must match the invitation.
      if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        throw createServiceError(
          403,
          "INVITATION_EMAIL_MISMATCH",
          "Sign in using the email address that received this invitation",
        );
      }

      // Confirm that the organization is still active.
      const organization = await Organization.findOne({
        _id: invitation.organization,
        status: "active",
      })
        .select("_id name")
        .session(session);

      if (!organization) {
        throw createServiceError(
          404,
          "ORGANIZATION_NOT_FOUND",
          "The invited organization is no longer active",
        );
      }

      // Prevent duplicate memberships.
      const existingMembership = await Membership.findOne({
        user: user._id,
        organization: organization._id,
      })
        .select("_id status")
        .session(session)
        .lean();

      if (existingMembership) {
        throw createServiceError(
          409,
          "USER_ALREADY_ORGANIZATION_MEMBER",
          "You already have a membership in this organization",
        );
      }

      // Atomically claim the pending invitation.
      const acceptedInvitation = await OrganizationInvitation.findOneAndUpdate(
        {
          _id: invitation._id,
          status: "pending",
          expiresAt: { $gt: now },
        },
        {
          $set: {
            status: "accepted",
            acceptedAt: now,
          },
        },
        {
          new: true,
          session,
        },
      );

      if (!acceptedInvitation) {
        throw createServiceError(
          409,
          "INVITATION_NOT_PENDING",
          "This invitation has already been used or is no longer valid",
        );
      }

      // Create the active organization membership.
      const [membership] = await Membership.create(
        [
          {
            user: user._id,
            organization: organization._id,
            role: invitation.role,
            status: "active",
          },
        ],
        { session },
      );

      result = {
        organization: {
          id: organization._id.toString(),
          name: organization.name,
        },
        membership: {
          id: membership._id.toString(),
          role: membership.role,
          status: membership.status,
        },
      };
    });
  } catch (error) {
    if (error.code === 11000) {
      throw createServiceError(
        409,
        "USER_ALREADY_ORGANIZATION_MEMBER",
        "You already have a membership in this organization",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }

  if (acceptanceError) {
    throw acceptanceError;
  }

  return result;
}
