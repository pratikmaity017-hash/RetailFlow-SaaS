import mongoose from "mongoose";

const businessCategoryFeatureSchema = new mongoose.Schema(
  {
    businessCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessCategory",
      required: true,
    },

    feature: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feature",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// A feature can be mapped only once to a particular category.
businessCategoryFeatureSchema.index(
  { businessCategory: 1, feature: 1 },
  { unique: true },
);

const BusinessCategoryFeature = mongoose.model(
  "BusinessCategoryFeature",
  businessCategoryFeatureSchema,
);

export default BusinessCategoryFeature;
