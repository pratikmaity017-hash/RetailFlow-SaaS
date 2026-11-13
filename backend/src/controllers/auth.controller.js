import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  logoutAllSessions,
} from "../services/auth.service.js";

import {
  requestEmailVerification,
  verifyEmailVerificationToken,
} from "../services/email-verification.service.js";

export async function register(req, res, next) {
  try {
    const result = await registerUser(req.body);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser({
      ...req.body,
      userAgent: req.get("user-agent"),
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function refresh(req, res, next) {
  try {
    const result = await refreshAccessToken(req.body);

    return res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        tokens: result,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    await logoutUser({
      userId: req.auth.userId,
      sessionId: req.auth.sessionId,
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutAll(req, res, next) {
  try {
    const result = await logoutAllSessions({
      userId: req.auth.userId,
    });

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function sendEmailVerificationController(req, res, next) {
  try {
    await requestEmailVerification({
      userId: req.auth.userId,
    });

    return res.status(202).json({
      success: true,
      message:
        "If your account has an unverified email address, a verification email will be sent.",
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailController(req, res, next) {
  try {
    const result = await verifyEmailVerificationToken({
      token: req.body.token,
    });

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
}
