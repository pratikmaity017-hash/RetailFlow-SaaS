import mongoose from "mongoose";

const organizationInvitationSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    role: {
      type: String,
      enum: ["manager", "sales_staff"],
      required: true,
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    acceptedAt: {
      type: Date,
      default: null,
    },

    revokedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Only one pending invitation per organization and email.
organizationInvitationSchema.index(
  { organization: 1, email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "pending",
    },
  },
);

organizationInvitationSchema.index({ expiresAt: 1 });

const OrganizationInvitation = mongoose.model(
  "OrganizationInvitation",
  organizationInvitationSchema,
);

export default OrganizationInvitation;
