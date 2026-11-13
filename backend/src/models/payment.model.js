import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
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
      index: true,
    },

    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: "Payment amount must be a safe integer in paise",
      },
    },

    method: {
      type: String,
      enum: ["cash", "card", "upi", "bank_transfer", "other"],
      required: true,
    },

    reference: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index({
  organization: 1,
  sale: 1,
  createdAt: -1,
});

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;
