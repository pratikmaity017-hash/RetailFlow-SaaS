import mongoose from "mongoose";

const pendingChangeSchema = new mongoose.Schema(
  {
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
    },

    billingInterval: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },

    effectiveAt: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const subscriptionSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization is required"],
      unique: true,
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: [true, "Subscription plan is required"],
    },

    status: {
      type: String,
      enum: ["active", "past_due", "canceled", "expired"],
      default: "active",
      required: true,
      index: true,
    },

    billingInterval: {
      type: String,
      enum: ["none", "monthly", "yearly"],
      default: "none",
      required: true,
    },

    currentPeriodStart: {
      type: Date,
      required: [true, "Current period start date is required"],
    },

    currentPeriodEnd: {
      type: Date,
      default: null,
    },

    nextBillingAt: {
      type: Date,
      default: null,
    },

    gracePeriodEndsAt: {
      type: Date,
      default: null,
    },

    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },

    canceledAt: {
      type: Date,
      default: null,
    },

    pendingChange: {
      type: pendingChangeSchema,
      default: null,
    },

    razorpayCustomerId: {
      type: String,
      trim: true,
      default: null,
    },

    razorpaySubscriptionId: {
      type: String,
      trim: true,
    },

    lastPaymentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

subscriptionSchema.index(
  { razorpaySubscriptionId: 1 },
  {
    unique: true,
    sparse: true,
  },
);

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
