import mongoose from "mongoose";

const saleSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    status: {
      type: String,
      enum: ["completed", "cancelled"],
      default: "completed",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "partially_paid", "paid"],
      default: "unpaid",
    },

    currency: {
      type: String,
      uppercase: true,
      default: "INR",
      minlength: 3,
      maxlength: 3,
    },

    subtotalPaise: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    discountPaise: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    taxPaise: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    totalPaise: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    amountPaidPaise: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    balanceDuePaise: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

saleSchema.index({
  organization: 1,
  createdAt: -1,
});

saleSchema.index({
  organization: 1,
  customer: 1,
  createdAt: -1,
});

saleSchema.index({
  organization: 1,
  paymentStatus: 1,
  createdAt: -1,
});

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
