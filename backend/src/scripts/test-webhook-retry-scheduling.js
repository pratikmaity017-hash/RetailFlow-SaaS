import "dotenv/config";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import WebhookEvent from "../models/webhook-event.model.js";
import { recoverWebhookEvents } from "../services/razorpay-webhook.service.js";

let testEventId = null;

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  const now = new Date();

  // Safety: do not interfere with other due webhook events.
  const existingDueEvents = await WebhookEvent.countDocuments({
    retryCount: { $lt: 8 },
    $or: [
      { status: "failed", nextRetryAt: { $lte: now } },
      {
        status: "processing",
        $or: [
          { processingStartedAt: { $lte: new Date(now.getTime() - 600000) } },
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
    eventId: `evt_test_retry_${randomUUID()}`,
    eventType: "payment.failed",
    payload: {},
    status: "failed",
    retryCount: 0,
    nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
    failureReason: "Temporary test failure",
  });

  testEventId = event._id;

  console.log("PASS: Future retry event created");

  // First run: event must not be claimed before nextRetryAt.
  const earlyResult = await recoverWebhookEvents({
    batchSize: 1,
  });

  console.log("Early recovery result:", earlyResult);

  if (earlyResult.checked !== 0) {
    throw new Error("Event was recovered before its retry time");
  }

  console.log("PASS: Future retry event was not claimed early");

  // Make the retry eligible.
  await WebhookEvent.updateOne(
    { _id: testEventId },
    { $set: { nextRetryAt: new Date(Date.now() - 1000) } },
  );

  const retryResult = await recoverWebhookEvents({
    batchSize: 1,
  });

  console.log("Retry recovery result:", retryResult);

  const updatedEvent = await WebhookEvent.findById(testEventId)
    .select("+processingToken")
    .lean();

  if (
    retryResult.checked !== 1 ||
    retryResult.failed !== 1 ||
    updatedEvent.status !== "failed" ||
    updatedEvent.retryCount !== 1
  ) {
    throw new Error("Due retry recovery verification failed");
  }

  if (
    updatedEvent.processingToken !== null ||
    updatedEvent.processingStartedAt !== null
  ) {
    throw new Error("Processing lock was not cleared");
  }

  console.log("PASS: Event was retried after becoming due");
  console.log("PASS: Retry count incremented");
  console.log("PASS: Processing lock cleared");
  console.log("PASS: Retry scheduling eligibility verified");
} catch (error) {
  console.error("RETRY SCHEDULING TEST FAILED:", error.message);
  process.exitCode = 1;
} finally {
  if (testEventId) {
    await WebhookEvent.deleteOne({ _id: testEventId });
    console.log("PASS: Fake event cleaned up");
  }

  await mongoose.disconnect();
  console.log("MongoDB disconnected");
}
