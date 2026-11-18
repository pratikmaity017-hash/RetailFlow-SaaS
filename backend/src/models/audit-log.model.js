import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 100,
    },

    resourceType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 50,
    },

    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    ipAddress: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
  },
);

// Organization audit history, newest first.
auditLogSchema.index({
  organization: 1,
  createdAt: -1,
});

// Filter audit history by action.
auditLogSchema.index({
  organization: 1,
  action: 1,
  createdAt: -1,
});

// Filter audit history by resource.
auditLogSchema.index({
  organization: 1,
  resourceType: 1,
  resourceId: 1,
  createdAt: -1,
});

// Filter activity by user.
auditLogSchema.index({
  organization: 1,
  actor: 1,
  createdAt: -1,
});

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
