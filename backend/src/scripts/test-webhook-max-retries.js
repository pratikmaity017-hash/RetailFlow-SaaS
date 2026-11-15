import "dotenv/config";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import WebhookEvent from "../models/webhook-event.model.js";
import { recoverWebhookEvents } from "../services/razorpay-webhook.service.js";

const MAX_RETRIES = 8;

let testEventId = null;

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 10 * 60 * 1000);

  // Safety: avoid processing other due events during this test.
  const existingDueEvents = await WebhookEvent.countDocuments({
    retryCount: { $lt: MAX_RETRIES },
    $or: [
      { status: "failed", nextRetryAt: { $lte: now } },
      {
        status: "processing",
        $or: [
          { processingStartedAt: { $lte: staleBefore } },
          { processingStartedAt: null },
          { processingStartedAt: { $exists: false } },
        ],
      },
    ],
  });

  if (existingDueEvents > 0) {
    throw new Error(
      `Safety check stopped test: ${existingDueEvents} other event(s) are due.`,
    );
  }

  const event = await WebhookEvent.create({
    eventId: `evt_test_max_retries_${randomUUID()}`,
    eventType: "payment.failed",
    payload: {},
    status: "failed",
    retryCount: MAX_RETRIES,
    nextRetryAt: new Date(Date.now() - 1000),
    failureReason: "Maximum retry limit reached",
  });

  testEventId = event._id;

  console.log("PASS: Event created at maximum retry limit");

  const result = await recoverWebhookEvents({
    batchSize: 1,
  });

  console.log("Recovery result:", result);

  const unchangedEvent = await WebhookEvent.findById(testEventId)
    .select("+processingToken")
    .lean();

  if (
    result.checked !== 0 ||
    result.processed !== 0 ||
    result.failed !== 0 ||
    result.skipped !== 0
  ) {
    throw new Error("Maximum retry limit was not respected");
  }

  if (
    unchangedEvent.status !== "failed" ||
    unchangedEvent.retryCount !== MAX_RETRIES
  ) {
    throw new Error("Event was unexpectedly modified");
  }

  if (
    unchangedEvent.processingToken !== null ||
    unchangedEvent.processingStartedAt !== null
  ) {
    throw new Error("Event was unexpectedly claimed");
  }

  console.log("PASS: Event at retry limit was not claimed");
  console.log("PASS: Retry count remained 8");
  console.log("PASS: Event status remained failed");
  console.log("PASS: Maximum retry limit verified");
} catch (error) {
  console.error("MAX RETRY TEST FAILED:", error.message);
  process.exitCode = 1;
} finally {
  if (testEventId) {
    await WebhookEvent.deleteOne({ _id: testEventId });
    console.log("PASS: Fake event cleaned up");
  }

  await mongoose.disconnect();
  console.log("MongoDB disconnected");
}
