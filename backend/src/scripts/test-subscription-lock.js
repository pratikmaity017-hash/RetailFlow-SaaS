import "dotenv/config";
import mongoose from "mongoose";

import {
  acquireSubscriptionOperationLock,
  releaseSubscriptionOperationLock,
} from "../utils/subscription-operation-lock.util.js";

const organizationId = "6af8af6bdf52d25defd9aa32";

let firstLock;
let thirdLock;

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

  // 3. Release the first lock.
  await releaseSubscriptionOperationLock(firstLock);
  firstLock = null;

  console.log("PASS: First lock released");

  // 4. A new lock should now succeed.
  thirdLock = await acquireSubscriptionOperationLock({
    organizationId,
    operation: "cancellation",
  });

  console.log("PASS: New lock acquired after release");
} catch (error) {
  console.error("LOCK TEST FAILED:", error);
  process.exitCode = 1;
} finally {
  if (firstLock) {
    await releaseSubscriptionOperationLock(firstLock);
  }

  if (thirdLock) {
    await releaseSubscriptionOperationLock(thirdLock);
  }

  await mongoose.disconnect();
}
