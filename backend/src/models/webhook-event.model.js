import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, "Webhook event ID is required"],
      trim: true,
      unique: true,
      maxlength: 150,
    },

    eventType: {
      type: String,
      required: [true, "Webhook event type is required"],
      trim: true,
      maxlength: 150,
      index: true,
    },

    status: {
      type: String,
      enum: ["received", "processing", "processed", "failed"],
      default: "received",
      required: true,
      index: true,
    },

    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Webhook payload is required"],
    },

    processedAt: {
      type: Date,
      default: null,
    },

    failureReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    retryCount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: "Retry count must be a safe integer",
      },
    },
  },
  {
    timestamps: true,
  },
);

webhookEventSchema.index({
  status: 1,
  createdAt: 1,
});

const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);

export default WebhookEvent;
