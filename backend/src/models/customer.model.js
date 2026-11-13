import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 254,
      default: "",
    },

    address: {
      street: {
        type: String,
        trim: true,
        maxlength: 150,
        default: "",
      },
      city: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
      },
      state: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
      },
      postalCode: {
        type: String,
        trim: true,
        maxlength: 20,
        default: "",
      },
      country: {
        type: String,
        trim: true,
        maxlength: 100,
        default: "",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Organization-scoped customer listing.
customerSchema.index({
  organization: 1,
  status: 1,
  createdAt: -1,
});

// Organization-scoped phone lookup.
customerSchema.index({
  organization: 1,
  phone: 1,
});

const Customer = mongoose.model("Customer", customerSchema);

export default Customer;
