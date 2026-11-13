import mongoose from "mongoose";

const businessCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Business category name is required"],
      trim: true,
      minlength: [2, "Category name must contain at least 2 characters"],
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },

    slug: {
      type: String,
      required: [true, "Business category slug is required"],
      lowercase: true,
      trim: true,
      unique: true,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    sortOrder: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

businessCategorySchema.index({ status: 1, sortOrder: 1, name: 1 });

const BusinessCategory = mongoose.model(
  "BusinessCategory",
  businessCategorySchema,
);

export default BusinessCategory;
