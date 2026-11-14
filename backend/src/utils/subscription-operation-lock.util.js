import { randomUUID } from "node:crypto";
import Subscription from "../models/subscription.model.js";

const LOCK_DURATION_MS = 5 * 60 * 1000;

function createLockError() {
  const error = new Error(
    "Another billing operation is already in progress. Please try again shortly.",
  );

  error.statusCode = 409;
  error.code = "BILLING_OPERATION_IN_PROGRESS";

  return error;
}

export async function acquireSubscriptionOperationLock({
  organizationId,
  operation,
}) {
  const now = new Date();
  const token = randomUUID();

  const subscription = await Subscription.findOneAndUpdate(
    {
      organization: organizationId,
      $or: [
        {
          "billingOperationLock.token": null,
        },
        {
          "billingOperationLock.expiresAt": {
            $lte: now,
          },
        },
      ],
    },
    {
      $set: {
        billingOperationLock: {
          token,
          operation,
          expiresAt: new Date(now.getTime() + LOCK_DURATION_MS),
        },
      },
    },
    {
      returnDocument: "after",
    },
  ).select("_id");

  if (!subscription) {
    throw createLockError();
  }

  return {
    subscriptionId: subscription._id,
    token,
  };
}

export async function releaseSubscriptionOperationLock({
  subscriptionId,
  token,
}) {
  await Subscription.updateOne(
    {
      _id: subscriptionId,
      "billingOperationLock.token": token,
    },
    {
      $set: {
        billingOperationLock: null,
      },
    },
  );
}
