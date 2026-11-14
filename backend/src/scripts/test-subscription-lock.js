import "dotenv/config";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import Subscription from "../models/subscription.model.js";

import {
  acquireSubscriptionOperationLock,
  renewSubscriptionOperationLock,
  startSubscriptionOperationLockHeartbeat,
  releaseSubscriptionOperationLock,
} from "../utils/subscription-operation-lock.util.js";

const organizationId = "6af8af6bdf52d25defd9aa32";

let firstLock;
let thirdLock;
let heartbeat;

try {
  await mongoose.connect(process.env.MONGODB_URI);

  console.log("MongoDB connected");

  // 1. First lock should succeed.
  firstLock = await acquireSubscriptionOperationLock({
    organizationId,
    operation: "renewal",
  });

  console.log("PASS: First lock acquired");

  // 2. Second lock should fail while the first lock is active.
  try {
    await acquireSubscriptionOperationLock({
      organizationId,
      operation: "cancellation",
    });

    throw new Error("Second lock unexpectedly succeeded");
  } catch (error) {
    if (error.code !== "BILLING_OPERATION_IN_PROGRESS") {
      throw error;
    }

    console.log("PASS: Concurrent lock rejected");
  }

  // 3. Lock expiry should extend when renewed.
  const beforeRenewal = await Subscription.findById(
    firstLock.subscriptionId,
  ).select("billingOperationLock.expiresAt");

  await renewSubscriptionOperationLock(firstLock);

  const afterRenewal = await Subscription.findById(
    firstLock.subscriptionId,
  ).select("billingOperationLock.expiresAt");

  if (
    afterRenewal.billingOperationLock.expiresAt <=
    beforeRenewal.billingOperationLock.expiresAt
  ) {
    throw new Error("Lock expiry was not extended");
  }

  console.log("PASS: Lock expiry extended");

  // 4. Heartbeat ownership verification should succeed.
  heartbeat = startSubscriptionOperationLockHeartbeat(firstLock);

  await heartbeat.assertOwnership();

  console.log("PASS: Heartbeat ownership verified");

  // 5. Simulate another process taking over the lock.
  await Subscription.updateOne(
    {
      _id: firstLock.subscriptionId,
      "billingOperationLock.token": firstLock.token,
    },
    {
      $set: {
        "billingOperationLock.token": randomUUID(),
        "billingOperationLock.expiresAt": new Date(Date.now() + 5 * 60 * 1000),
      },
    },
  );

  try {
    await heartbeat.assertOwnership();

    throw new Error("Ownership verification unexpectedly succeeded");
  } catch (error) {
    if (error.code !== "BILLING_OPERATION_LOCK_LOST") {
      throw error;
    }

    console.log("PASS: Lost lock ownership detected");
  }

  heartbeat.stop();
  heartbeat = null;

  // The original token no longer owns this lock.
  // Clear the test lock explicitly.
  await Subscription.updateOne(
    {
      _id: firstLock.subscriptionId,
    },
    {
      $set: {
        billingOperationLock: null,
      },
    },
  );

  firstLock = null;

  console.log("PASS: Test lock cleaned up");

  // 6. A new lock should now succeed.
  thirdLock = await acquireSubscriptionOperationLock({
    organizationId,
    operation: "cancellation",
  });

  console.log("PASS: New lock acquired after release");
} catch (error) {
  console.error("LOCK TEST FAILED:", error);
  process.exitCode = 1;
} finally {
  heartbeat?.stop();

  if (firstLock) {
    await releaseSubscriptionOperationLock(firstLock);
  }

  if (thirdLock) {
    await releaseSubscriptionOperationLock(thirdLock);
  }

  await mongoose.disconnect();
}
