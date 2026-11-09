import mongoose from "mongoose";
import User from "../models/user.model.js";
import RefreshSession from "../models/refresh-session.model.js";
import { verifyAccessToken } from "../utils/token.util.js";
import { createServiceError } from "../utils/service-error.util.js";

export async function authenticate(req, res, next) {
  try {
    // 1. Read the Authorization header.
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      throw createServiceError(
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication is required",
      );
    }

    // 2. Extract the access token.
    const accessToken = authorization.slice(7).trim();

    if (!accessToken) {
      throw createServiceError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Invalid access token",
      );
    }

    // 3. Verify the JWT signature and expiration.
    const payload = verifyAccessToken(accessToken);

    // 4. Validate required token claims.
    if (typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      throw createServiceError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Invalid access token",
      );
    }

    // 5. Validate MongoDB ObjectIds.
    if (
      !mongoose.isValidObjectId(payload.sub) ||
      !mongoose.isValidObjectId(payload.sid)
    ) {
      throw createServiceError(
        401,
        "INVALID_ACCESS_TOKEN",
        "Invalid access token",
      );
    }

    // 6. Check whether the session is still active.
    const session = await RefreshSession.findOne({
      _id: payload.sid,
      user: payload.sub,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      throw createServiceError(
        401,
        "SESSION_INVALID",
        "Your session is expired or revoked. Please log in again.",
      );
    }

    // 7. Check whether the user is active.
    const user = await User.findById(payload.sub).select("_id status");

    if (!user || user.status !== "active") {
      throw createServiceError(
        401,
        "ACCOUNT_UNAVAILABLE",
        "Your account is unavailable",
      );
    }

    // 8. Attach authenticated identity.
    req.auth = {
      userId: user._id.toString(),
      sessionId: session._id.toString(),
    };

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return next(
        createServiceError(
          401,
          "INVALID_ACCESS_TOKEN",
          "Invalid or expired access token",
        ),
      );
    }

    next(error);
  }
}
