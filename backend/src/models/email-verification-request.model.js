import mongoose from "mongoose";

const emailVerificationRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    authIdentity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AuthIdentity",
      required: true,
    },
  },
  {
    timestamps: true,
    strict: true,
  },
);

// Count requests made by an identity during the last 24 hours.
emailVerificationRequestSchema.index(
  {
    authIdentity: 1,
    createdAt: -1,
  },
  {
    name: "identity_request_history",
  },
);

// Automatically remove request history after 24 hours.
emailVerificationRequestSchema.index(
  {
    createdAt: 1,
  },
  {
    expireAfterSeconds: 86400,
    name: "verification_request_ttl",
  },
);

const EmailVerificationRequest = mongoose.model(
  "EmailVerificationRequest",
  emailVerificationRequestSchema,
);

export default EmailVerificationRequest;
