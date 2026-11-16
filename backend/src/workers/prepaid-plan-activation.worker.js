import Subscription from "../models/subscription.model.js";
import { createSubscriptionRenewal } from "../services/subscription-renewal.service.js";

const WORKER_INTERVAL_MS = 60 * 1000;
const BATCH_SIZE = 25;

let workerInterval = null;
let activeRun = null;

async function runPrepaidPlanActivation() {
  if (activeRun) {
    return activeRun;
  }

  activeRun = (async () => {
    try {
      const dueSubscriptions = await Subscription.find({
        "pendingChange.effectiveAt": {
          $lte: new Date(),
        },

        "pendingChange.billingPayment": {
          $exists: true,
          $ne: null,
        },

        cancelAtPeriodEnd: {
          $ne: true,
        },

        status: {
          $in: ["active", "past_due", "expired"],
        },
      })
        .select("organization pendingChange.billingInterval")
        .sort({ "pendingChange.effectiveAt": 1 })
        .limit(BATCH_SIZE)
        .lean();

      for (const subscription of dueSubscriptions) {
        try {
          const result = await createSubscriptionRenewal({
            organizationId: subscription.organization,
            billingInterval: subscription.pendingChange.billingInterval,
          });

          if (result.planChangeActivated) {
            console.log(
              "Prepaid plan activated successfully:",
              subscription.organization.toString(),
            );
          }
        } catch (error) {
          if (error.code === "BILLING_OPERATION_IN_PROGRESS") {
            continue;
          }

          console.error(
            "Prepaid plan activation failed:",
            subscription.organization.toString(),
            error.message,
          );
        }
      }
    } catch (error) {
      console.error("Prepaid plan activation worker error:", error.message);
    }
  })();

  try {
    await activeRun;
  } finally {
    activeRun = null;
  }
}

export function startPrepaidPlanActivationWorker() {
  if (workerInterval) {
    return stopPrepaidPlanActivationWorker;
  }

  console.log("Prepaid plan activation worker started.");

  // Check immediately after server startup.
  void runPrepaidPlanActivation();

  workerInterval = setInterval(() => {
    void runPrepaidPlanActivation();
  }, WORKER_INTERVAL_MS);

  workerInterval.unref?.();

  return stopPrepaidPlanActivationWorker;
}

export async function stopPrepaidPlanActivationWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }

  if (activeRun) {
    await activeRun;
  }

  console.log("Prepaid plan activation worker stopped.");
}
