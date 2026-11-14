import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";

const GRACE_PERIOD_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 500;

function calculateGracePeriodEnd(currentPeriodEnd) {
  return new Date(
    new Date(currentPeriodEnd).getTime() + GRACE_PERIOD_DAYS * DAY_IN_MS,
  );
}

function getAvailableLockFilter(lockCheckTime) {
  return {
    $or: [
      {
        "billingOperationLock.token": null,
      },
      {
        "billingOperationLock.expiresAt": {
          $lte: lockCheckTime,
        },
      },
    ],
  };
}

function getConcurrencyFilter(subscription, lockCheckTime) {
  return {
    _id: subscription._id,
    status: subscription.status,
    currentPeriodEnd: subscription.currentPeriodEnd,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    ...getAvailableLockFilter(lockCheckTime),
  };
}

async function moveSubscriptionToFreePlan({
  subscription,
  freePlanId,
  now,
  lockCheckTime,
  dryRun,
}) {
  if (dryRun) {
    return true;
  }

  const result = await Subscription.updateOne(
    getConcurrencyFilter(subscription, lockCheckTime),
    {
      $set: {
        plan: freePlanId,
        status: "active",
        billingInterval: "none",
        currentPeriodStart: now,
        currentPeriodEnd: null,
        nextBillingAt: null,
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        pendingChange: null,
      },
    },
  );

  return result.modifiedCount === 1;
}

export async function processSubscriptionLifecycle({
  now = new Date(),
  dryRun = false,
} = {}) {
  const currentTime = new Date(now);

  if (Number.isNaN(currentTime.getTime())) {
    throw new Error("INVALID_LIFECYCLE_DATE");
  }

  // Always use actual system time for billing lock checks.
  // The supplied `now` is only for subscription lifecycle simulation.
  const lockCheckTime = new Date();

  const freePlan = await SubscriptionPlan.findOne({
    code: "free",
    isActive: true,
  })
    .select("_id")
    .lean();

  if (!freePlan) {
    throw new Error("ACTIVE_FREE_PLAN_NOT_FOUND");
  }

  const graceCutoff = new Date(
    currentTime.getTime() - GRACE_PERIOD_DAYS * DAY_IN_MS,
  );

  const subscriptions = await Subscription.find({
    plan: {
      $ne: freePlan._id,
    },

    $and: [
      getAvailableLockFilter(lockCheckTime),

      {
        $or: [
          {
            status: "active",
            currentPeriodEnd: {
              $ne: null,
              $lte: currentTime,
            },
          },
          {
            status: "past_due",
            $or: [
              {
                gracePeriodEndsAt: {
                  $lte: currentTime,
                },
              },
              {
                gracePeriodEndsAt: null,
                currentPeriodEnd: {
                  $lte: graceCutoff,
                },
              },
            ],
          },
        ],
      },
    ],
  })
    .select("_id status currentPeriodEnd gracePeriodEndsAt cancelAtPeriodEnd")
    .sort({
      currentPeriodEnd: 1,
    })
    .limit(BATCH_LIMIT)
    .lean();

  const summary = {
    checked: subscriptions.length,
    movedToPastDue: 0,
    movedToFree: 0,
    skipped: 0,
    dryRun,
  };

  for (const subscription of subscriptions) {
    if (subscription.status === "active") {
      const gracePeriodEndsAt = calculateGracePeriodEnd(
        subscription.currentPeriodEnd,
      );

      const shouldMoveToFree =
        subscription.cancelAtPeriodEnd || gracePeriodEndsAt <= currentTime;

      if (shouldMoveToFree) {
        const updated = await moveSubscriptionToFreePlan({
          subscription,
          freePlanId: freePlan._id,
          now: currentTime,
          lockCheckTime,
          dryRun,
        });

        if (updated) {
          summary.movedToFree += 1;
        } else {
          summary.skipped += 1;
        }

        continue;
      }

      if (dryRun) {
        summary.movedToPastDue += 1;
        continue;
      }

      const result = await Subscription.updateOne(
        {
          ...getConcurrencyFilter(subscription, lockCheckTime),
          status: "active",
          cancelAtPeriodEnd: false,
        },
        {
          $set: {
            status: "past_due",
            gracePeriodEndsAt,
          },
        },
      );

      if (result.modifiedCount === 1) {
        summary.movedToPastDue += 1;
      } else {
        summary.skipped += 1;
      }

      continue;
    }

    if (subscription.status === "past_due") {
      const gracePeriodEndsAt =
        subscription.gracePeriodEndsAt ||
        calculateGracePeriodEnd(subscription.currentPeriodEnd);

      if (gracePeriodEndsAt > currentTime) {
        summary.skipped += 1;
        continue;
      }

      const updated = await moveSubscriptionToFreePlan({
        subscription,
        freePlanId: freePlan._id,
        now: currentTime,
        lockCheckTime,
        dryRun,
      });

      if (updated) {
        summary.movedToFree += 1;
      } else {
        summary.skipped += 1;
      }
    }
  }

  return summary;
}
