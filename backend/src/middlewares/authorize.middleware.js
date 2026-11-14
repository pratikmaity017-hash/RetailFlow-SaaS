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

export function authorizeProductStatusChange(req, res, next) {
  if (req.body.status !== undefined && req.membership?.role !== "owner") {
    return next(
      createServiceError(
        403,
        "INSUFFICIENT_PERMISSIONS",
        "Only the organization owner can change product status",
      ),
    );
  }

  return next();
}

export function authorizeVariantStatusChange(req, res, next) {
  if (req.body.status !== undefined && req.membership?.role !== "owner") {
    return next(
      createServiceError(
        403,
        "INSUFFICIENT_PERMISSIONS",
        "Only the organization owner can change product variant status",
      ),
    );
  }

  return next();
}

export function authorizeCustomerStatusChange(req, res, next) {
  if (req.body.status !== undefined && req.membership?.role !== "owner") {
    return next(
      createServiceError(
        403,
        "INSUFFICIENT_PERMISSIONS",
        "Only the organization owner can change customer status",
      ),
    );
  }

  return next();
}

export function authorizeSupplierStatusChange(req, res, next) {
  if (req.body.status !== undefined && req.membership?.role !== "owner") {
    return next(
      createServiceError(
        403,
        "INSUFFICIENT_PERMISSIONS",
        "Only the organization owner can change supplier status",
      ),
    );
  }

  return next();
}
