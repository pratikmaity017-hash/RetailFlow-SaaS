import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    return: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Return",
      required: true,
    },

    saleItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SaleItem",
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
    },

    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.001,
      max: 999999999,
      validate: {
        validator(value) {
          return (
            Number.isFinite(value) &&
            Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7
          );
        },
        message: "Quantity must be finite and have at most 3 decimal places",
      },
    },

    unitPricePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    refundAmountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    restock: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

returnItemSchema.index({
  organization: 1,
  return: 1,
});

returnItemSchema.index({
  organization: 1,
  saleItem: 1,
});

const ReturnItem = mongoose.model("ReturnItem", returnItemSchema);

export default ReturnItem;
