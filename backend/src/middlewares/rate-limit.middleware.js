import crypto from "node:crypto";

import RateLimit from "../models/rate-limit.model.js";
import { env } from "../config/env.js";

const KEY_HASH_SECRET = env.JWT_SECRET;

function hashRateLimitKey(key) {
  return crypto.createHmac("sha256", KEY_HASH_SECRET).update(key).digest("hex");
}

export function createRateLimiter({ name, limit, windowMs }) {
  if (
    !name ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(windowMs) ||
    windowMs < 1
  ) {
    throw new Error("Invalid rate limiter configuration.");
  }

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      const keyHash = hashRateLimitKey(`${name}:${clientIp}`);

      const now = Date.now();
      const windowStartMs = Math.floor(now / windowMs) * windowMs;
      const windowStart = new Date(windowStartMs);
      const windowEndMs = windowStartMs + windowMs;

      const expiresAt = new Date(windowEndMs + 60 * 60 * 1000);

      let record;

      try {
        record = await RateLimit.findOneAndUpdate(
          {
            keyHash,
            windowStart,
          },
          {
            $inc: {
              count: 1,
            },
            $setOnInsert: {
              expiresAt,
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            setDefaultsOnInsert: true,
          },
        );
      } catch (error) {
        // Another request may have inserted the same window concurrently.
        if (error?.code !== 11000) {
          throw error;
        }

        record = await RateLimit.findOneAndUpdate(
          {
            keyHash,
            windowStart,
          },
          {
            $inc: {
              count: 1,
            },
          },
          {
            returnDocument: "after",
          },
        );
      }

      if (!record) {
        throw new Error("Rate limit counter could not be updated.");
      }

      const remaining = Math.max(0, limit - record.count);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowEndMs - now) / 1000),
      );

      res.set("RateLimit-Limit", String(limit));
      res.set("RateLimit-Remaining", String(remaining));
      res.set("RateLimit-Reset", String(retryAfterSeconds));

      if (record.count > limit) {
        res.set("Retry-After", String(retryAfterSeconds));

        return res.status(429).json({
          success: false,
          error: {
            code: "AUTH_RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
