import { createServiceError } from "../utils/service-error.util.js";

export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.membership) {
      return next(
        createServiceError(
          403,
          "ORGANIZATION_CONTEXT_REQUIRED",
          "Organization context is required",
        ),
      );
    }

    if (!allowedRoles.includes(req.membership.role)) {
      return next(
        createServiceError(
          403,
          "INSUFFICIENT_PERMISSIONS",
          "You do not have permission to perform this action",
        ),
      );
    }

    return next();
  };
}
