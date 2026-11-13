import mongoose from "mongoose";

import { env } from "../config/env.js";
import AuthIdentity from "../models/auth-identity.model.js";
import User from "../models/user.model.js";
import EmailVerificationToken from "../models/email-verification-token.model.js";
import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from "../utils/email-verification-token.js";
import { sendEmail } from "./email.service.js";
import { createEmailVerificationTemplate } from "../templates/email-verification.template.js";

const TOKEN_EXPIRY_MINUTES = 30;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_24_HOURS = 5;
const RATE_LIMIT_WINDOW_HOURS = 24;

function createVerificationError(message, code, statusCode = 400) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

export async function sendEmailVerification({ user, authIdentity }) {
  if (!user?._id || !authIdentity?._id) {
    throw createVerificationError(
      "User and email identity are required.",
      "INVALID_VERIFICATION_REQUEST",
    );
  }

  if (
    authIdentity.provider !== "email" ||
    authIdentity.user.toString() !== user._id.toString()
  ) {
    throw createVerificationError(
      "Invalid email identity.",
      "INVALID_EMAIL_IDENTITY",
    );
  }

  if (user.status !== "active" || authIdentity.status !== "active") {
    throw createVerificationError(
      "Account is not active.",
      "ACCOUNT_NOT_ACTIVE",
      403,
    );
  }

  if (user.emailVerifiedAt || authIdentity.verifiedAt) {
    return {
      sent: false,
      reason: "already_verified",
    };
  }

  if (!authIdentity.email) {
    throw createVerificationError(
      "Email address is missing.",
      "EMAIL_NOT_FOUND",
    );
  }

  const rawToken = generateEmailVerificationToken();
  const tokenHash = hashEmailVerificationToken(rawToken);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  const rateLimitWindowStart = new Date(
    now.getTime() - RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000,
  );

  const session = await mongoose.startSession();
  let createdToken;

  try {
    await session.withTransaction(async () => {
      // Serialize verification requests for this identity.
      // Concurrent transactions updating the same identity will conflict.
      const identityUpdate = await AuthIdentity.updateOne(
        {
          _id: authIdentity._id,
          provider: "email",
          status: "active",
        },
        {
          $inc: {
            emailVerificationRequestVersion: 1,
          },
        },
        { session },
      );

      if (identityUpdate.matchedCount !== 1) {
        throw createVerificationError(
          "Email identity is unavailable.",
          "INVALID_EMAIL_IDENTITY",
        );
      }

      // Count all token records created during the last 24 hours.
      // This includes consumed and invalidated tokens.
      const recentRequestCount = await EmailVerificationToken.countDocuments({
        authIdentity: authIdentity._id,
        createdAt: { $gte: rateLimitWindowStart },
      }).session(session);
      
      if (recentRequestCount >= MAX_REQUESTS_PER_24_HOURS) {
        throw createVerificationError(
          "You have reached the verification email request limit. Please try again later.",
          "EMAIL_VERIFICATION_DAILY_LIMIT",
          429,
        );
      }

      // Find the latest currently usable token.
      const latestToken = await EmailVerificationToken.findOne({
        authIdentity: authIdentity._id,
        consumedAt: null,
        invalidatedAt: null,
        expiresAt: { $gt: now },
      })
        .sort({ createdAt: -1 })
        .session(session);

      if (latestToken) {
        const cooldownEndsAt =
          latestToken.createdAt.getTime() + RESEND_COOLDOWN_SECONDS * 1000;

        if (now.getTime() < cooldownEndsAt) {
          const retryAfterSeconds = Math.ceil(
            (cooldownEndsAt - now.getTime()) / 1000,
          );

          throw createVerificationError(
            `Please wait ${retryAfterSeconds} seconds before requesting another verification email.`,
            "EMAIL_VERIFICATION_COOLDOWN",
            429,
          );
        }
      }

      // Invalidate previous unused verification tokens.
      await EmailVerificationToken.updateMany(
        {
          authIdentity: authIdentity._id,
          consumedAt: null,
          invalidatedAt: null,
        },
        {
          $set: {
            invalidatedAt: now,
          },
        },
        { session },
      );

      const [tokenDocument] = await EmailVerificationToken.create(
        [
          {
            user: user._id,
            authIdentity: authIdentity._id,
            tokenHash,
            expiresAt,
          },
        ],
        { session },
      );

      createdToken = tokenDocument;
    });
  } finally {
    await session.endSession();
  }

  const verificationUrl = new URL("/verify-email", env.FRONTEND_URL);
  verificationUrl.searchParams.set("token", rawToken);

  const emailContent = createEmailVerificationTemplate({
    name: user.name,
    verificationUrl: verificationUrl.toString(),
  });

  try {
    await sendEmail({
      to: authIdentity.email,
      ...emailContent,
    });
  } catch (error) {
    // Invalidate the token if email delivery fails.
    await EmailVerificationToken.updateOne(
      {
        _id: createdToken._id,
        consumedAt: null,
        invalidatedAt: null,
      },
      {
        $set: {
          invalidatedAt: new Date(),
        },
      },
    );

    throw createVerificationError(
      "Unable to send verification email. Please try again later.",
      "EMAIL_DELIVERY_FAILED",
      503,
    );
  }

  return {
    sent: true,
    expiresAt,
  };
}

export async function verifyEmailVerificationToken({ token }) {
  if (typeof token !== "string" || token.length !== 43) {
    throw createVerificationError(
      "Invalid or expired verification link.",
      "INVALID_OR_EXPIRED_VERIFICATION_TOKEN",
    );
  }

  const tokenHash = hashEmailVerificationToken(token);
  const now = new Date();

  const session = await mongoose.startSession();

  let verificationResult = false;

  try {
    await session.withTransaction(async () => {
      // Atomically consume the token.
      const tokenDocument = await EmailVerificationToken.findOneAndUpdate(
        {
          tokenHash,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            consumedAt: now,
          },
        },
        {
          returnDocument: "after",
          session,
        },
      );

      if (!tokenDocument) {
        throw createVerificationError(
          "Invalid or expired verification link.",
          "INVALID_OR_EXPIRED_VERIFICATION_TOKEN",
        );
      }

      const authIdentity = await AuthIdentity.findOne({
        _id: tokenDocument.authIdentity,
        user: tokenDocument.user,
        provider: "email",
        status: "active",
      }).session(session);

      const user = await User.findOne({
        _id: tokenDocument.user,
        status: "active",
      }).session(session);

      if (!authIdentity || !user) {
        throw createVerificationError(
          "Invalid or expired verification link.",
          "INVALID_OR_EXPIRED_VERIFICATION_TOKEN",
        );
      }

      if (user.email.toLowerCase() !== authIdentity.email.toLowerCase()) {
        throw createVerificationError(
          "Email identity does not match the user account.",
          "EMAIL_IDENTITY_MISMATCH",
        );
      }

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            emailVerifiedAt: now,
          },
        },
        { session },
      );

      await AuthIdentity.updateOne(
        { _id: authIdentity._id },
        {
          $set: {
            verifiedAt: now,
          },
        },
        { session },
      );

      verificationResult = true;
    });
  } finally {
    await session.endSession();
  }

  return {
    verified: verificationResult,
    message: "Email address verified successfully.",
  };
}

export async function requestEmailVerification({ userId }) {
  const user = await User.findById(userId).select(
    "_id name email status emailVerifiedAt",
  );

  if (!user) {
    return { accepted: true };
  }

  const authIdentity = await AuthIdentity.findOne({
    user: user._id,
    provider: "email",
  }).select("_id user provider email status verifiedAt");

  if (!authIdentity) {
    return { accepted: true };
  }

  await sendEmailVerification({
    user,
    authIdentity,
  });

  return { accepted: true };
}
