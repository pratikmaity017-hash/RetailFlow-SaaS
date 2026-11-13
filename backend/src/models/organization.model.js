import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Organization name is required"],
      trim: true,
      minlength: [2, "Organization name must contain at least 2 characters"],
      maxlength: [150, "Organization name cannot exceed 150 characters"],
    },

    slug: {
      type: String,
      required: [true, "Organization slug is required"],
      lowercase: true,
      trim: true,
      unique: true,
      maxlength: 160,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },

    address: {
      street: {
        type: String,
        trim: true,
        maxlength: 150,
      },

      city: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      state: {
        type: String,
        trim: true,
        maxlength: 100,
      },

      postalCode: {
        type: String,
        trim: true,
        maxlength: 20,
      },

      country: {
        type: String,
        trim: true,
        maxlength: 100,
      },
    },

    primaryCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessCategory",
      default: null,
    },

    additionalCategories: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "BusinessCategory",
        },
      ],
      default: [],
    },

    settings: {
      locale: {
        type: String,
        trim: true,
        default: "en-IN",
      },

      timezone: {
        type: String,
        trim: true,
        default: "Asia/Kolkata",
      },

      dateFormat: {
        type: String,
        enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"],
        default: "DD/MM/YYYY",
      },

      timeFormat: {
        type: String,
        enum: ["12h", "24h"],
        default: "12h",
      },
    },

    status: {
      type: String,
      enum: ["active", "suspended", "disabled"],
      default: "active",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Organization creator is required"],
    },
  },
  {
    timestamps: true,
  },
);

const Organization = mongoose.model("Organization", organizationSchema);

export default Organization;
