import { recoverWebhookEvents } from "../services/razorpay-webhook.service.js";

let isRunning = false;

const WEBHOOK_RECOVERY_INTERVAL_MS = 60 * 1000;
const WEBHOOK_RECOVERY_BATCH_SIZE = 10;

let recoveryInterval = null;
let activeRun = null;

async function runWebhookRecovery() {
  if (activeRun) {
    return activeRun;
  }

  activeRun = (async () => {
    try {
      const result = await recoverWebhookEvents({
        batchSize: WEBHOOK_RECOVERY_BATCH_SIZE,
      });

      if (result.checked > 0) {
        console.log("Webhook recovery completed:", result);
      }
    } catch (error) {
      console.error("Webhook recovery worker error:", error.message);
    } finally {
      activeRun = null;
    }
  })();

  return activeRun;
}

export function startWebhookRecoveryWorker() {
  if (recoveryInterval) {
    return stopWebhookRecoveryWorker;
  }

  console.log("Webhook recovery worker started.");

  void runWebhookRecovery();

  recoveryInterval = setInterval(
    runWebhookRecovery,
    WEBHOOK_RECOVERY_INTERVAL_MS,
  );

  return stopWebhookRecoveryWorker;
}

export async function stopWebhookRecoveryWorker() {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = null;
  }

  if (activeRun) {
    await activeRun;
  }

  console.log("Webhook recovery worker stopped.");
}
