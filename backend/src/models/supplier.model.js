import mongoose from "mongoose";

const supplierAddressSchema = new mongoose.Schema(
  {
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
  {
    _id: false,
  },
);

const supplierSchema = new mongoose.Schema(
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

    contactPerson: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },

    alternatePhone: {
      type: String,
      trim: true,
      maxlength: 20,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
    },

    address: {
      type: supplierAddressSchema,
      default: () => ({}),
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 15,
      default: "",
    },

    pan: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 10,
      default: "",
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
      required: true,
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

supplierSchema.index({
  organization: 1,
  status: 1,
  createdAt: -1,
});

supplierSchema.index({
  organization: 1,
  phone: 1,
});

const Supplier = mongoose.model("Supplier", supplierSchema);

export default Supplier;
