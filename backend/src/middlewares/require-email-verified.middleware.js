import User from "../models/user.model.js";
import { createServiceError } from "../utils/service-error.util.js";

export async function requireEmailVerified(req, res, next) {
  try {
    const user = await User.findById(req.auth.userId).select(
      "_id emailVerifiedAt status",
    );

    if (!user || user.status !== "active") {
      throw createServiceError(
        401,
        "ACCOUNT_UNAVAILABLE",
        "Your account is unavailable",
      );
    }

    if (!user.emailVerifiedAt) {
      throw createServiceError(
        403,
        "EMAIL_VERIFICATION_REQUIRED",
        "Please verify your email address before accessing organization features.",
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
