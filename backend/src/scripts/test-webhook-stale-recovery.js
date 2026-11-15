import "dotenv/config";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import WebhookEvent from "../models/webhook-event.model.js";
import { recoverWebhookEvents } from "../services/razorpay-webhook.service.js";

const PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;

let testEventId = null;

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  const eventId = `evt_test_stale_${randomUUID()}`;

  const staleEvent = await WebhookEvent.create({
    eventId,
    eventType: "payment.failed",
    payload: {},
    status: "processing",
    processingStartedAt: new Date(Date.now() - PROCESSING_TIMEOUT_MS - 60_000),
    processingToken: randomUUID(),
    retryCount: 0,
    nextRetryAt: null,
  });

  testEventId = staleEvent._id;

  console.log("PASS: Stale processing event created");

  const result = await recoverWebhookEvents({
    batchSize: 1,
  });

  console.log("Recovery result:", result);

  const recoveredEvent = await WebhookEvent.findById(testEventId)
    .select("+processingToken")
    .lean();

  if (result.checked !== 1 || result.failed !== 1) {
    throw new Error("Recovery result verification failed");
  }

  if (recoveredEvent.status !== "failed" || recoveredEvent.retryCount !== 1) {
    throw new Error("Stale event status or retry count is incorrect");
  }

  if (
    recoveredEvent.processingStartedAt !== null ||
    recoveredEvent.processingToken !== null
  ) {
    throw new Error("Processing lock was not cleared");
  }

  if (recoveredEvent.nextRetryAt !== null) {
    throw new Error("Permanent failure should not have a retry time");
  }

  if (
    recoveredEvent.failureReason !==
    "Failed webhook payment details are missing"
  ) {
    throw new Error("Unexpected failure reason");
  }

  console.log("PASS: Stale event was successfully claimed");
  console.log("PASS: Retry count incremented");
  console.log("PASS: Processing lock cleared");
  console.log("PASS: Permanent failure recorded");
  console.log("PASS: Stale recovery verification successful");
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
