import mongoose from "mongoose";
import crypto from "node:crypto";

import Organization from "../models/organization.model.js";
import Membership from "../models/membership.model.js";

function generateOrganizationSlug(name) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const safeBaseSlug = baseSlug || "organization";
  const uniqueSuffix = crypto.randomUUID().slice(0, 8);

  return `${safeBaseSlug}-${uniqueSuffix}`;
}

export async function createOrganization({ userId, name }) {
  const session = await mongoose.startSession();

  let result;

  try {
    await session.withTransaction(async () => {
      const [organization] = await Organization.create(
        [
          {
            name,
            slug: generateOrganizationSlug(name),
            createdBy: userId,
          },
        ],
        { session },
      );

      const [membership] = await Membership.create(
        [
          {
            user: userId,
            organization: organization._id,
            role: "owner",
            status: "active",
          },
        ],
        { session },
      );

      result = {
        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
          status: organization.status,
        },
        membership: {
          id: membership._id,
          role: membership.role,
          status: membership.status,
        },
      };
    });
  } finally {
    await session.endSession();
  }

  return result;
}

export async function getUserOrganizations({ userId }) {
  const memberships = await Membership.find({
    user: userId,
    status: "active",
  })
    .populate({
      path: "organization",
      match: { status: "active" },
      select: "_id name slug",
    })
    .sort({ createdAt: 1 })
    .lean();

  return memberships
    .filter((membership) => membership.organization)
    .map((membership) => ({
      membershipId: membership._id.toString(),
      role: membership.role,
      organization: {
        id: membership.organization._id.toString(),
        name: membership.organization.name,
        slug: membership.organization.slug,
      },
    }));
}
