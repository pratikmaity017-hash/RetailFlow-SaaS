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

    paymentType: {
      type: String,
      enum: ["initial", "renewal", "plan_change"],
      default: "initial",
      required: true,
      index: true,
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
      enum: [
        "pending",
        "authorized",
        "cancellation_pending",
        "captured",
        "failed",
        "refund_pending",
        "refunded",
      ],
      default: "pending",
      required: true,
      index: true,
    },

    orderCreationStatus: {
      type: String,
      enum: ["not_started", "creating", "created", "unknown", "failed"],
      default: "not_started",
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

    razorpayRefundId: {
      type: String,
      trim: true,
      default: null,
    },

    refundStatus: {
      type: String,
      enum: ["pending", "processing", "processed", "failed"],
      default: null,
    },

    refundProcessingAt: {
      type: Date,
      default: null,
    },

    reconciliation: {
      status: {
        type: String,
        enum: ["not_required", "pending", "resolved"],
        default: "not_required",
      },

      reason: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null,
      },

      requiredAt: {
        type: Date,
        default: null,
      },

      resolvedAt: {
        type: Date,
        default: null,
      },
    },

    refundRetryCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 8,
    },

    refundManualReviewRequired: {
      type: Boolean,
      default: false,
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

billingPaymentSchema.index(
  { subscription: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [
          "pending",
          "authorized",
          "cancellation_pending",
          "refund_pending",
        ],
      },
    },
    name: "uniq_unresolved_payment_per_subscription",
  },
);

const BillingPayment = mongoose.model("BillingPayment", billingPaymentSchema);

export default BillingPayment;
