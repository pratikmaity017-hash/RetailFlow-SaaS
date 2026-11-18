import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    // Historical snapshot: supplier details may change later.
    supplierName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    supplierInvoiceNumber: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["draft", "ordered", "partially_received", "received", "cancelled"],
      default: "draft",
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
      immutable: true,
    },

    // All monetary values are stored as integer paise.
    subtotalPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Subtotal must be a safe integer in paise",
      },
    },

    discountPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Discount must be a safe integer in paise",
      },
    },

    taxPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Tax must be a safe integer in paise",
      },
    },

    totalPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Total must be a safe integer in paise",
      },
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: null,
    },

    orderedAt: {
      type: Date,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
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

purchaseSchema.index({
  organization: 1,
  status: 1,
  purchaseDate: -1,
});

purchaseSchema.index({
  organization: 1,
  supplier: 1,
  purchaseDate: -1,
});

purchaseSchema.index({
  organization: 1,
  createdAt: -1,
});

const Purchase = mongoose.model("Purchase", purchaseSchema);

export default Purchase;
