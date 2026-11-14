import { randomUUID } from "node:crypto";
import Subscription from "../models/subscription.model.js";

const LOCK_DURATION_MS = 5 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

function createLockError() {
  const error = new Error(
    "Another billing operation is already in progress. Please try again shortly.",
  );

  error.statusCode = 409;
  error.code = "BILLING_OPERATION_IN_PROGRESS";

  return error;
}

function createLockLostError() {
  const error = new Error(
    "Billing operation lock was lost. The operation cannot safely continue.",
  );

  error.statusCode = 409;
  error.code = "BILLING_OPERATION_LOCK_LOST";

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

export async function assertSubscriptionOperationLock({
  subscriptionId,
  token,
}) {
  const now = new Date();

  const subscription = await Subscription.exists({
    _id: subscriptionId,
    "billingOperationLock.token": token,
    "billingOperationLock.expiresAt": {
      $gt: now,
    },
  });

  if (!subscription) {
    throw createLockLostError();
  }

  return true;
}

export async function renewSubscriptionOperationLock({
  subscriptionId,
  token,
}) {
  const now = new Date();

  const result = await Subscription.updateOne(
    {
      _id: subscriptionId,
      "billingOperationLock.token": token,
      "billingOperationLock.expiresAt": {
        $gt: now,
      },
    },
    {
      $set: {
        "billingOperationLock.expiresAt": new Date(
          now.getTime() + LOCK_DURATION_MS,
        ),
      },
    },
  );

  if (result.modifiedCount !== 1) {
    throw createLockLostError();
  }

  return true;
}

export function startSubscriptionOperationLockHeartbeat(lock) {
  let stopped = false;
  let lockLost = false;
  let heartbeatInProgress = false;

  const timer = setInterval(async () => {
    if (stopped || lockLost || heartbeatInProgress) {
      return;
    }

    heartbeatInProgress = true;

    try {
      await renewSubscriptionOperationLock(lock);
    } catch {
      lockLost = true;
      clearInterval(timer);
    } finally {
      heartbeatInProgress = false;
    }
  }, HEARTBEAT_INTERVAL_MS);

  timer.unref?.();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },

    async assertOwnership() {
      if (lockLost) {
        throw createLockLostError();
      }

      await assertSubscriptionOperationLock(lock);
    },
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
