import mongoose from "mongoose";

const billingPaymentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
      index: true,
    },

    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: [true, "Subscription is required"],
      index: true,
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: [true, "Subscription plan is required"],
    },

    amountPaise: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Payment amount must be a safe integer in paise",
      },
    },

    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: "INR",
      enum: ["INR"],
    },

    billingInterval: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "authorized", "captured", "failed", "refunded"],
      default: "pending",
      required: true,
      index: true,
    },

    gateway: {
      type: String,
      enum: ["razorpay"],
      default: "razorpay",
      required: true,
    },

    razorpayOrderId: {
      type: String,
      trim: true,
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

billingPaymentSchema.index(
  { razorpayOrderId: 1 },
  { unique: true, sparse: true },
);

billingPaymentSchema.index(
  { razorpayPaymentId: 1 },
  { unique: true, sparse: true },
);

billingPaymentSchema.index({
  organization: 1,
  createdAt: -1,
});

const BillingPayment = mongoose.model("BillingPayment", billingPaymentSchema);

export default BillingPayment;
