import mongoose from "mongoose";

const emailVerificationTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    authIdentity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuthIdentity",
      required: [true, "Auth identity reference is required"],
    },

    // SHA-256 hash of the original verification token.
    tokenHash: {
      type: String,
      required: [true, "Token hash is required"],
      unique: true,
      match: [/^[a-f0-9]{64}$/, "Invalid token hash format"],
      select: false,
    },

    expiresAt: {
      type: Date,
      required: [true, "Token expiration date is required"],
    },

    consumedAt: {
      type: Date,
      default: null,
    },

    invalidatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

// Find verification tokens belonging to an identity.
emailVerificationTokenSchema.index(
  {
    authIdentity: 1,
    createdAt: -1,
  },
  {
    name: "identity_verification_lookup",
  },
);

// Automatically clean up expired documents.
// Application logic must still check expiresAt.
emailVerificationTokenSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
    name: "verification_token_ttl",
  },
);

const EmailVerificationToken = mongoose.model(
  "EmailVerificationToken",
  emailVerificationTokenSchema,
);

export default EmailVerificationToken;
