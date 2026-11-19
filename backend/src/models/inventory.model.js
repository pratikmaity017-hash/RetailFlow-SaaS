import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
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
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      validate: {
        validator(value) {
          return (
            Number.isFinite(value) &&
            Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7
          );
        },
        message: "Quantity can have at most 3 decimal places",
      },
    },

    lowStockThreshold: {
      type: Number,
      required: true,
      min: 0,
      max: 999999999,
      validate: {
        validator(value) {
          return (
            Number.isFinite(value) &&
            Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7
          );
        },
        message: "Value must be finite and have at most 3 decimal places",
      },
      default: 5,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// One inventory record per variant per organization.
inventorySchema.index({ organization: 1, variant: 1 }, { unique: true });

inventorySchema.index({
  organization: 1,
  quantity: 1,
});

const Inventory = mongoose.model("Inventory", inventorySchema);

export default Inventory;
