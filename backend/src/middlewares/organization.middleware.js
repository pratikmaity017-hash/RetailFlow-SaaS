import mongoose from "mongoose";
import Organization from "../models/organization.model.js";
import Membership from "../models/membership.model.js";
import { createServiceError } from "../utils/service-error.util.js";

export async function requireOrganization(req, res, next) {
  try {
    // 1. Get organization ID from the URL.
    const { organizationId } = req.params;

    if (!mongoose.isValidObjectId(organizationId)) {
      throw createServiceError(
        400,
        "INVALID_ORGANIZATION_ID",
        "Invalid organization ID",
      );
    }

    // 2. Find the organization.
    const organization = await Organization.findOne({
      _id: organizationId,
      status: "active",
    }).select("_id name slug");

    if (!organization) {
      throw createServiceError(
        404,
        "ORGANIZATION_NOT_FOUND",
        "Organization not found or unavailable",
      );
    }

    // 3. Verify the authenticated user's membership.
    const membership = await Membership.findOne({
      user: req.auth.userId,
      organization: organization._id,
      status: "active",
    }).select("_id role");

    if (!membership) {
      throw createServiceError(
        403,
        "ORGANIZATION_ACCESS_DENIED",
        "You do not have access to this organization",
      );
    }

    // 4. Attach trusted organization context.
    req.organization = {
      id: organization._id.toString(),
      name: organization.name,
      slug: organization.slug,
    };

    req.membership = {
      id: membership._id.toString(),
      role: membership.role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}
