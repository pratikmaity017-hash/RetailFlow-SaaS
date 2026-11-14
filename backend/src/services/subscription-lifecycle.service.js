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

async function moveSubscriptionToFreePlan({
  subscription,
  freePlanId,
  now,
  dryRun,
}) {
  if (dryRun) {
    return true;
  }

  const result = await Subscription.updateOne(
    {
      _id: subscription._id,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      ...(subscription.status === "past_due"
        ? { gracePeriodEndsAt: subscription.gracePeriodEndsAt }
        : {}),
    },
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
  const freePlan = await SubscriptionPlan.findOne({
    code: "free",
    isActive: true,
  })
    .select("_id")
    .lean();

  if (!freePlan) {
    throw new Error("ACTIVE_FREE_PLAN_NOT_FOUND");
  }

  const graceCutoff = new Date(now.getTime() - GRACE_PERIOD_DAYS * DAY_IN_MS);

  const subscriptions = await Subscription.find({
    plan: { $ne: freePlan._id },

    $or: [
      {
        status: "active",
        currentPeriodEnd: {
          $ne: null,
          $lte: now,
        },
      },
      {
        status: "past_due",
        $or: [
          {
            gracePeriodEndsAt: {
              $lte: now,
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
  })
    .select("_id status currentPeriodEnd gracePeriodEndsAt cancelAtPeriodEnd")
    .sort({ currentPeriodEnd: 1 })
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
        subscription.cancelAtPeriodEnd || gracePeriodEndsAt <= now;

      if (shouldMoveToFree) {
        const updated = await moveSubscriptionToFreePlan({
          subscription,
          freePlanId: freePlan._id,
          now,
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
          _id: subscription._id,
          status: "active",
          currentPeriodEnd: subscription.currentPeriodEnd,
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

      if (gracePeriodEndsAt > now) {
        summary.skipped += 1;
        continue;
      }

      const updated = await moveSubscriptionToFreePlan({
        subscription,
        freePlanId: freePlan._id,
        now,
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
