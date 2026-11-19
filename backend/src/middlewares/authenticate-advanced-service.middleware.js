import { timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";
import { createServiceError } from "../utils/service-error.util.js";

export function authenticateAdvancedService(req, res, next) {
  const configuredKey = env.ADVANCED_SERVICE_API_KEY;
  const suppliedKey = req.get("X-Service-Key");

  if (!configuredKey) {
    return next(
      createServiceError(
        503,
        "INTERNAL_SERVICE_AUTH_NOT_CONFIGURED",
        "Internal service authentication is not configured.",
      ),
    );
  }

  if (!suppliedKey) {
    return next(
      createServiceError(
        401,
        "INTERNAL_SERVICE_AUTH_REQUIRED",
        "Internal service authentication is required.",
      ),
    );
  }

  const expected = Buffer.from(configuredKey, "utf8");
  const received = Buffer.from(suppliedKey, "utf8");

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    return next(
      createServiceError(
        401,
        "INVALID_INTERNAL_SERVICE_CREDENTIAL",
        "Invalid internal service credentials.",
      ),
    );
  }

  req.internalService = { name: "advanced-backend" };

  return next();
}
