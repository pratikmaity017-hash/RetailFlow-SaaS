import mongoose from "mongoose";

import AuditLog from "../models/audit-log.model.js";
import { createServiceError } from "../utils/service-error.util.js";

function createDateRange(from, to) {
  const range = {};

  if (from) {
    range.$gte = new Date(`${from}T00:00:00.000Z`);
  }

  if (to) {
    const nextDay = new Date(`${to}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    range.$lt = nextDay;
  }

  return range;
}

export async function listAuditLogs({ organizationId, query }) {
  if (!mongoose.isValidObjectId(organizationId)) {
    throw createServiceError(
      400,
      "INVALID_ORGANIZATION_ID",
      "Invalid organization ID",
    );
  }

  const { action, resourceType, actorId, resourceId, from, to, page, limit } =
    query;

  const filter = {
    organization: new mongoose.Types.ObjectId(organizationId),
  };

  if (action) {
    filter.action = action.toLowerCase();
  }

  if (resourceType) {
    filter.resourceType = resourceType.toLowerCase();
  }

  if (actorId) {
    filter.actor = new mongoose.Types.ObjectId(actorId);
  }

  if (resourceId) {
    filter.resourceId = new mongoose.Types.ObjectId(resourceId);
  }

  if (from || to) {
    filter.createdAt = createDateRange(from, to);
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actor", "name email")
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    AuditLog.countDocuments(filter),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}
