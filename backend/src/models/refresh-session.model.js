import mongoose from "mongoose";

const refreshSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    familyId: {
      type: String,
      required: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    revokedAt: {
      type: Date,
      default: null,
    },

    replacedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RefreshSession",
      default: null,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    ipAddress: {
      type: String,
      trim: true,
      maxlength: 45,
    },
  },
  {
    timestamps: true,
  },
);

// Automatically delete expired refresh sessions.
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshSession = mongoose.model("RefreshSession", refreshSessionSchema);

export default RefreshSession;
