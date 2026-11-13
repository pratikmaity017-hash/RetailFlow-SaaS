import mongoose from "mongoose";
import crypto from "node:crypto";

import User from "../models/user.model.js";
import AuthIdentity from "../models/auth-identity.model.js";
import Organization from "../models/organization.model.js";
import Membership from "../models/membership.model.js";
import RefreshSession from "../models/refresh-session.model.js";
import { env } from "../config/env.js";
import { sendEmailVerification } from "./email-verification.service.js";

import { hashPassword, comparePassword } from "../utils/password.util.js";
import {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from "../utils/token.util.js";
import { createServiceError } from "../utils/service-error.util.js";

function validatePasswordLength(password) {
  const passwordBytes = Buffer.byteLength(password, "utf8");

  if (passwordBytes > 72) {
    throw createServiceError(
      400,
      "PASSWORD_TOO_LONG",
      "Password cannot exceed 72 bytes",
    );
  }
}

function generateOrganizationSlug(name) {
  const baseSlug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const safeBaseSlug = baseSlug || "organization";
  const uniqueSuffix = crypto.randomUUID().slice(0, 8);

  return `${safeBaseSlug}-${uniqueSuffix}`;
}

export async function registerUser({
  name,
  email,
  password,
  organizationName,
}) {
  // Normalize email before checking for an existing account.
  const normalizedEmail = email.trim().toLowerCase();

  // Check bcrypt's 72-byte input limit.
  validatePasswordLength(password);

  // Check whether this email is already registered.
  const existingUser = await User.findOne({
    email: normalizedEmail,
  });

  if (existingUser) {
    throw createServiceError(
      409,
      "EMAIL_ALREADY_REGISTERED",
      "An account with this email already exists",
    );
  }

  // Hash password before storing it.
  const passwordHash = await hashPassword(password);

  // Generate a unique organization slug.
  const organizationSlug = generateOrganizationSlug(organizationName);

  const session = await mongoose.startSession();

  let registeredData;
  let verificationData;

  try {
    await session.withTransaction(async () => {
      // 1. Create User.
      const [user] = await User.create(
        [
          {
            name,
            email: normalizedEmail,
            passwordHash,
          },
        ],
        { session },
      );

      // 2. Create email authentication identity.
      const [authIdentity] = await AuthIdentity.create(
        [
          {
            user: user._id,
            provider: "email",
            providerSubject: normalizedEmail,
            email: normalizedEmail,
            passwordHash,
            verifiedAt: user.emailVerifiedAt,
          },
        ],
        { session },
      );

      // Preserve references for sending verification after commit.
      verificationData = {
        user,
        authIdentity,
      };

      // 3. Create Organization.
      const [organization] = await Organization.create(
        [
          {
            name: organizationName,
            slug: organizationSlug,
            createdBy: user._id,
          },
        ],
        { session },
      );

      // 4. Create Membership.
      const [membership] = await Membership.create(
        [
          {
            user: user._id,
            organization: organization._id,
            role: "owner",
            status: "active",
          },
        ],
        { session },
      );

      registeredData = {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },

        organization: {
          id: organization._id,
          name: organization.name,
          slug: organization.slug,
        },

        membership: {
          id: membership._id,
          role: membership.role,
          status: membership.status,
        },
      };
    });
  } catch (error) {
    // Handle duplicate email or AuthIdentity records.
    const isDuplicateEmailIdentity =
      error.code === 11000 &&
      (error.keyPattern?.email ||
        (error.keyPattern?.provider && error.keyPattern?.providerSubject) ||
        error.keyValue?.providerSubject);

    if (isDuplicateEmailIdentity) {
      throw createServiceError(
        409,
        "EMAIL_ALREADY_REGISTERED",
        "An account with this email already exists",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }

  // 5. Send verification email after successful transaction.
  // Email delivery failure must not undo registration.
  try {
    await sendEmailVerification(verificationData);
  } catch (error) {
    console.error(
      "Registration succeeded, but verification email could not be sent.",
      {
        code: error.code || "EMAIL_DELIVERY_ERROR",
      },
    );
  }

  return registeredData;
}

export async function loginUser({ email, password, userAgent, ipAddress }) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
  }).select("+passwordHash");

  if (!user) {
    throw createServiceError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password",
    );
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);

  if (!isPasswordValid) {
    throw createServiceError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password",
    );
  }

  if (user.status !== "active") {
    throw createServiceError(
      403,
      "ACCOUNT_DISABLED",
      "Your account is disabled",
    );
  }

  // Generate refresh token.
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  // Create a unique session family.
  const familyId = crypto.randomUUID();

  // Calculate session expiration.
  const expiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  // Save the refresh session.
  const session = await RefreshSession.create({
    user: user._id,
    tokenHash,
    familyId,
    expiresAt,
    userAgent,
    ipAddress,
  });

  // Generate access token.
  const accessToken = generateAccessToken({
    sub: user._id.toString(),
    sid: session._id.toString(),
  });

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      emailVerifiedAt: user.emailVerifiedAt,
    },
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

export async function refreshAccessToken({ refreshToken }) {
  const tokenHash = hashRefreshToken(refreshToken);
  const oldSession = await RefreshSession.findOne({ tokenHash });

  if (!oldSession) {
    throw createServiceError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Invalid refresh token",
    );
  }

  // A previously rotated token has been reused.
  if (oldSession.replacedBy) {
    await RefreshSession.updateMany(
      { familyId: oldSession.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );

    throw createServiceError(
      401,
      "REFRESH_TOKEN_REUSE_DETECTED",
      "Refresh token reuse detected. Please log in again.",
    );
  }

  const now = new Date();

  if (oldSession.revokedAt || oldSession.expiresAt <= now) {
    throw createServiceError(
      401,
      "REFRESH_SESSION_EXPIRED",
      "Refresh session is expired or revoked",
    );
  }

  const user = await User.findById(oldSession.user);

  if (!user || user.status !== "active") {
    throw createServiceError(
      401,
      "INVALID_REFRESH_SESSION",
      "This session is no longer valid",
    );
  }

  const newRefreshToken = generateRefreshToken();
  const newTokenHash = hashRefreshToken(newRefreshToken);

  const dbSession = await mongoose.startSession();

  let result;

  try {
    await dbSession.withTransaction(async () => {
      // Atomically claim the old session.
      // Only one request can successfully match these conditions.
      const claimedSession = await RefreshSession.findOneAndUpdate(
        {
          _id: oldSession._id,
          revokedAt: null,
          replacedBy: null,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            revokedAt: now,
            lastUsedAt: now,
          },
        },
        {
          returnDocument: "before",
          session: dbSession,
        },
      );

      if (!claimedSession) {
        throw createServiceError(
          409,
          "REFRESH_ROTATION_CONFLICT",
          "Refresh token has already been used",
        );
      }

      // Create the replacement session.
      const [newSession] = await RefreshSession.create(
        [
          {
            user: oldSession.user,
            tokenHash: newTokenHash,
            familyId: oldSession.familyId,
            expiresAt: oldSession.expiresAt,
            userAgent: oldSession.userAgent,
            ipAddress: oldSession.ipAddress,
          },
        ],
        { session: dbSession },
      );

      // Link the old session to its replacement.
      await RefreshSession.updateOne(
        { _id: oldSession._id },
        { $set: { replacedBy: newSession._id } },
        { session: dbSession },
      );

      const accessToken = generateAccessToken({
        sub: user._id.toString(),
        sid: newSession._id.toString(),
      });

      result = {
        accessToken,
        refreshToken: newRefreshToken,
      };
    });
  } catch (error) {
    // Another request may have rotated this token first.
    if (error.code === "REFRESH_ROTATION_CONFLICT") {
      const latestSession = await RefreshSession.findById(oldSession._id);

      if (latestSession?.replacedBy) {
        await RefreshSession.updateMany(
          { familyId: latestSession.familyId, revokedAt: null },
          { $set: { revokedAt: new Date() } },
        );

        throw createServiceError(
          401,
          "REFRESH_TOKEN_REUSE_DETECTED",
          "Refresh token reuse detected. Please log in again.",
        );
      }

      throw createServiceError(
        401,
        "REFRESH_SESSION_EXPIRED",
        "Refresh session is no longer valid",
      );
    }

    throw error;
  } finally {
    await dbSession.endSession();
  }

  return result;
}

export async function logoutUser({ userId, sessionId }) {
  const session = await RefreshSession.findOneAndUpdate(
    {
      _id: sessionId,
      user: userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
    {
      returnDocument: "after",
    },
  );

  if (!session) {
    throw createServiceError(
      401,
      "SESSION_INVALID",
      "Session is already revoked or invalid",
    );
  }

  return {
    message: "Logged out successfully",
  };
}

export async function logoutAllSessions({ userId }) {
  const result = await RefreshSession.updateMany(
    {
      user: userId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
      },
    },
  );

  return {
    revokedSessions: result.modifiedCount,
  };
}
