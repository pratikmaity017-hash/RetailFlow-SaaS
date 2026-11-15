import "dotenv/config";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import WebhookEvent from "../models/webhook-event.model.js";
import { recoverWebhookEvents } from "../services/razorpay-webhook.service.js";

const eventId = `evt_test_stale_${randomUUID()}`;
let testEventId = null;

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  const now = new Date();
  const staleTime = new Date(now.getTime() - 11 * 60 * 1000);

  const existingDueEvents = await WebhookEvent.countDocuments({
    retryCount: { $lt: 8 },
    $or: [
      { status: "failed", nextRetryAt: { $lte: now } },
      {
        status: "processing",
        $or: [
          { processingStartedAt: { $lte: now.getTime() - 10 * 60 * 1000 } },
          { processingStartedAt: null },
          { processingStartedAt: { $exists: false } },
        ],
      },
    ],
  });

  if (existingDueEvents > 0) {
    throw new Error(
      `Safety check stopped: ${existingDueEvents} existing events are due for recovery.`,
    );
  }

  const testEvent = await WebhookEvent.create({
    eventId,
    eventType: "payment.failed",
    payload: {},
    status: "processing",
    processingStartedAt: staleTime,
    processingToken: randomUUID(),
    retryCount: 0,
  });

  testEventId = testEvent._id;
  console.log("PASS: Stale processing event created");

  const result = await recoverWebhookEvents({ batchSize: 1 });
  console.log("Recovery result:", result);

  const recovered =
    await WebhookEvent.findById(testEventId).select("+processingToken");

  if (
    result.checked !== 1 ||
    result.failed !== 1 ||
    recovered?.status !== "failed" ||
    recovered?.retryCount !== 1 ||
    recovered?.processingToken !== null
  ) {
    throw new Error("Stale event recovery verification failed");
  }

  console.log("PASS: Stale event reclaimed");
  console.log("PASS: Retry count incremented");
  console.log("PASS: Processing claim released");
  console.log("PASS: Event moved to failed state");
} catch (error) {
  console.error("STALE RECOVERY TEST FAILED:", error.message);
  process.exitCode = 1;
} finally {
  if (testEventId) {
    await WebhookEvent.deleteOne({ _id: testEventId });
    console.log("PASS: Fake event cleaned up");
  }

  await mongoose.disconnect();
  console.log("MongoDB disconnected");
}
