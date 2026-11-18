import mongoose from "mongoose";

const refundSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    return: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Return",
      required: true,
    },

    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isSafeInteger,
    },

    method: {
      type: String,
      enum: ["cash", "upi", "card", "bank_transfer", "other"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "processed", "failed"],
      default: "pending",
      required: true,
    },

    reference: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
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

refundSchema.index({ organization: 1, return: 1 }, { unique: true });

refundSchema.index({
  organization: 1,
  sale: 1,
  createdAt: -1,
});

refundSchema.index({
  organization: 1,
  status: 1,
  createdAt: -1,
});

const Refund = mongoose.model("Refund", refundSchema);

export default Refund;
