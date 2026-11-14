import mongoose from "mongoose";

const priceSchema = new mongoose.Schema(
  {
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Price must be a safe integer in paise",
      },
    },

    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: "INR",
      enum: ["INR"],
    },

    razorpayPlanId: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const subscriptionPlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Plan code is required"],
      lowercase: true,
      trim: true,
      unique: true,
      match: [
        /^[a-z0-9_-]+$/,
        "Plan code can contain only lowercase letters, numbers, hyphens and underscores",
      ],
      maxlength: 50,
    },

    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    prices: {
      monthly: {
        type: priceSchema,
        default: null,
      },

      yearly: {
        type: priceSchema,
        default: null,
      },
    },

    entitlements: {
      features: {
        type: Map,
        of: Boolean,
        default: {},
      },

      limits: {
        type: Map,
        of: Number,
        default: {},
      },
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

subscriptionPlanSchema.index({
  isActive: 1,
  sortOrder: 1,
});

const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema,
);

export default SubscriptionPlan;
