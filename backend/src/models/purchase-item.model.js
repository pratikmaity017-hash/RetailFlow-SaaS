import mongoose from "mongoose";

const purchaseItemSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    purchase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Purchase",
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

    // Historical snapshots
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

    orderedQuantity: {
      type: Number,
      required: true,
      min: 0.001,
      max: 999999999,
      validate: {
        validator(value) {
          return Number.isFinite(value) && Number(value.toFixed(3)) === value;
        },
        message:
          "Ordered quantity must be finite and have at most 3 decimal places",
      },
    },

    receivedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: 999999999,
      validate: {
        validator(value) {
          return Number.isFinite(value) && Number(value.toFixed(3)) === value;
        },
        message:
          "Received quantity must be finite and have at most 3 decimal places",
      },
    },

    // Purchase cost per unit, stored in integer paise.
    unitCostPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Unit cost must be a safe integer in paise",
      },
    },

    lineSubtotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Line subtotal must be a safe integer in paise",
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

    lineTotalPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Line total must be a safe integer in paise",
      },
    },
  },
  {
    timestamps: true,
  },
);

purchaseItemSchema.index({
  organization: 1,
  purchase: 1,
});

purchaseItemSchema.index({
  organization: 1,
  product: 1,
  createdAt: -1,
});

purchaseItemSchema.index({
  organization: 1,
  variant: 1,
  createdAt: -1,
});

const PurchaseItem = mongoose.model("PurchaseItem", purchaseItemSchema);

export default PurchaseItem;
