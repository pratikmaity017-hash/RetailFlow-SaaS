import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },

    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: [true, "Organization reference is required"],
    },
    role: {
      type: String,
      enum: ["owner", "manager", "sales_staff"],
      required: [true, "Membership role is required"],
    },
    status: {
      type: String,
      enum: ["active", "invited", "suspended"],
      default: "invited",
    },
  },
  {
    timestamps: true,
  },
);

membershipSchema.index({ user: 1, organization: 1 }, { unique: true });

const Membership = mongoose.model("Membership", membershipSchema);

export default Membership;
