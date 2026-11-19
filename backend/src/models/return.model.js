import mongoose from "mongoose";

const returnSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },

    returnNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
      required: true,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    totalQuantity: {
      type: Number,
      required: true,
      min: 0.001,
      max: 999999999,
      validate: {
        validator(value) {
          return (
            Number.isFinite(value) &&
            Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7
          );
        },
        message:
          "Total quantity must be finite and have at most 3 decimal places",
      },
    },

    totalRefundPaise: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    refundStatus: {
      type: String,
      enum: ["not_required", "pending", "processed", "failed"],
      default: "not_required",
      required: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

returnSchema.index({
  organization: 1,
  sale: 1,
  createdAt: -1,
});

returnSchema.index({
  organization: 1,
  status: 1,
  createdAt: -1,
});

returnSchema.index({ organization: 1, returnNumber: 1 }, { unique: true });

const Return = mongoose.model("Return", returnSchema);

export default Return;
