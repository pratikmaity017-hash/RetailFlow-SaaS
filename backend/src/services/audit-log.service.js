import AuditLog from "../models/audit-log.model.js";

// Exclude fields that must never be stored in audit metadata.
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|credential|api.?key|signature|cvv|otp/i;

// Keep metadata small, flat, and limited to primitive values.
function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  const safeMetadata = {};

  for (const [key, value] of Object.entries(metadata).slice(0, 20)) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(key) ||
      SENSITIVE_KEY_PATTERN.test(key)
    ) {
      continue;
    }

    if (
      value === null ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      safeMetadata[key] = value;
      continue;
    }

    if (typeof value === "string") {
      safeMetadata[key] = value.slice(0, 200);
    }
  }

  return safeMetadata;
}

export async function createAuditLog({
  organizationId,
  actorId = null,
  action,
  resourceType,
  resourceId = null,
  description,
  metadata = {},
  ipAddress = null,
  userAgent = null,
  session = null,
}) {
  const auditLogData = {
    organization: organizationId,
    actor: actorId,
    action,
    resourceType,
    resourceId,
    description,
    metadata: sanitizeMetadata(metadata),
    ipAddress,
    userAgent,
  };

  const options = session ? { session } : {};

  const [auditLog] = await AuditLog.create([auditLogData], options);

  return auditLog;
}
