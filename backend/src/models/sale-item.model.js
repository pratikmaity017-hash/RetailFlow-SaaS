import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    sale: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sale",
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

    // Product information saved at the time of sale.
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

    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.001,
      max: 1000000,
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

    // All monetary values are stored as integer paise.
    unitPricePaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    unitCostPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    lineSubtotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },

    discountPaise: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    taxPaise: {
      type: Number,
      min: 0,
      default: 0,
      validate: Number.isSafeInteger,
    },

    lineTotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
    },
  },
  {
    timestamps: true,
  },
);

saleItemSchema.index({
  organization: 1,
  sale: 1,
});

saleItemSchema.index({
  organization: 1,
  product: 1,
  createdAt: -1,
});

saleItemSchema.index({
  organization: 1,
  variant: 1,
  createdAt: -1,
});

const SaleItem = mongoose.model("SaleItem", saleItemSchema);

export default SaleItem;
