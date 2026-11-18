import mongoose from "mongoose";

const rateLimitSchema = new mongoose.Schema(
  {
    keyHash: {
      type: String,
      required: true,
    },
    windowStart: {
      type: Date,
      required: true,
    },
    count: {
      type: Number,
      required: true,
      min: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    versionKey: false,
    timestamps: false,
    strict: true,
  },
);

// One counter per key and fixed time window.
rateLimitSchema.index(
  {
    keyHash: 1,
    windowStart: 1,
  },
  {
    unique: true,
    name: "rate_limit_key_window_unique",
  },
);

// Automatically remove expired rate-limit records.
rateLimitSchema.index(
  {
    expiresAt: 1,
  },
  {
    expireAfterSeconds: 0,
    name: "rate_limit_ttl",
  },
);

const RateLimit = mongoose.model("RateLimit", rateLimitSchema);

export default RateLimit;
