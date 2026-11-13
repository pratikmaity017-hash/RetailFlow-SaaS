import mongoose from "mongoose";
import crypto from "node:crypto";

import Organization from "../models/organization.model.js";
import Membership from "../models/membership.model.js";

import BusinessCategory from "../models/business-category.model.js";
import { createServiceError } from "../utils/service-error.util.js";

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

export async function updateOrganizationCategories({
  organizationId,
  primaryCategory,
  additionalCategories,
}) {
  // Check for duplicate additional categories.
  const uniqueAdditionalCategories = new Set(additionalCategories);

  if (uniqueAdditionalCategories.size !== additionalCategories.length) {
    throw createServiceError(
      400,
      "DUPLICATE_ADDITIONAL_CATEGORIES",
      "Duplicate additional categories are not allowed",
    );
  }

  // Primary category cannot also be an additional category.
  if (uniqueAdditionalCategories.has(primaryCategory)) {
    throw createServiceError(
      400,
      "PRIMARY_CATEGORY_DUPLICATED",
      "Primary category cannot also be an additional category",
    );
  }

  // Collect all requested category IDs.
  const requestedCategoryIds = [primaryCategory, ...additionalCategories];

  // Verify that all categories exist and are active.
  const activeCategories = await BusinessCategory.find({
    _id: { $in: requestedCategoryIds },
    status: "active",
  })
    .select("_id")
    .lean();

  if (activeCategories.length !== requestedCategoryIds.length) {
    throw createServiceError(
      400,
      "INVALID_BUSINESS_CATEGORIES",
      "One or more business categories do not exist or are inactive",
    );
  }

  // Update only the category fields of the organization.
  const organization = await Organization.findByIdAndUpdate(
    organizationId,
    {
      $set: {
        primaryCategory,
        additionalCategories,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate({
      path: "primaryCategory",
      select: "name slug description",
    })
    .populate({
      path: "additionalCategories",
      select: "name slug description",
    });

  if (!organization) {
    throw createServiceError(
      404,
      "ORGANIZATION_NOT_FOUND",
      "Organization not found",
    );
  }

  return organization;
}
