import mongoose from "mongoose";

const featureSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z][a-z0-9_]*$/,
        "Feature code must contain lowercase letters, numbers, and underscores.",
      ],
    },

    name: {
      type: String,
      required: true,
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

    type: {
      type: String,
      enum: ["core", "advanced", "addon"],
      required: true,
      default: "core",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      required: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

const Feature = mongoose.model("Feature", featureSchema);

export default Feature;
