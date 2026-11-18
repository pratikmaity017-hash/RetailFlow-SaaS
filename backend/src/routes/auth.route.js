import { Router } from "express";
import { env } from "../config/env.js";

import {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  sendEmailVerificationController,
  verifyEmailController,
  googleLogin,
} from "../controllers/auth.controller.js";

import { validate } from "../middlewares/validate.middleware.js";

import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  sendEmailVerificationSchema,
  verifyEmailSchema,
  googleLoginSchema,
} from "../validators/auth.validator.js";

import { authenticate } from "../middlewares/authenticate.middleware.js";
import { createRateLimiter } from "../middlewares/rate-limit.middleware.js";
import User from "../models/user.model.js";

const registerRateLimit = createRateLimiter({
  name: "auth-register",
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

const loginRateLimit = createRateLimiter({
  name: "auth-login",
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

const googleLoginRateLimit = createRateLimiter({
  name: "auth-google",
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

const refreshRateLimit = createRateLimiter({
  name: "auth-refresh",
  limit: 30,
  windowMs: 15 * 60 * 1000,
});

const verificationSendRateLimit = createRateLimiter({
  name: "auth-verification-send",
  limit: 5,
  windowMs: 15 * 60 * 1000,
});

const verificationVerifyRateLimit = createRateLimiter({
  name: "auth-verification-verify",
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

const router = Router();

function useRefreshCookie(req, res, next) {
  req.body ||= {};

  if (!req.body.refreshToken && req.cookies?.refreshToken) {
    const origin = req.get("Origin");

    const allowedOrigins = new Set([
      env.FRONTEND_URL,
      ...(env.NODE_ENV === "development"
        ? ["http://localhost:3000", "http://127.0.0.1:5500"]
        : []),
    ]);

    if (!origin || !allowedOrigins.has(origin)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "CSRF_ORIGIN_REJECTED",
          message: "Request origin is not allowed.",
        },
      });
    }

    req.body.refreshToken = req.cookies.refreshToken;
  }

  if (!req.body.refreshToken && req.get("X-Client-Type") === "web") {
    return res.status(401).json({
      success: false,
      message: "Refresh session is unavailable.",
      code: "INVALID_REFRESH_TOKEN",
    });
  }

  next();
}

router.post("/register", registerRateLimit, validate(registerSchema), register);

router.post("/login", loginRateLimit, validate(loginSchema), login);

router.post(
  "/google",
  googleLoginRateLimit,
  validate(googleLoginSchema),
  googleLogin,
);

router.post(
  "/refresh",
  refreshRateLimit,
  useRefreshCookie,
  validate(refreshTokenSchema),
  refresh,
);

router.post(
  "/email-verification/send",
  verificationSendRateLimit,
  authenticate,
  validate(sendEmailVerificationSchema),
  sendEmailVerificationController,
);

router.post(
  "/email-verification/verify",
  verificationVerifyRateLimit,
  validate(verifyEmailSchema),
  verifyEmailController,
);

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth.userId).select(
      "_id name email emailVerifiedAt",
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account is unavailable",
        code: "ACCOUNT_UNAVAILABLE",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Authentication successful",
      data: {
        userId: req.auth.userId,
        sessionId: req.auth.sessionId,
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", authenticate, logout);
router.post("/logout-all", authenticate, logoutAll);

export default router;
