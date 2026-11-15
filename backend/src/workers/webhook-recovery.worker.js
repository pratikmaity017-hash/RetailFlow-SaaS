import { recoverWebhookEvents } from "../services/razorpay-webhook.service.js";

const WEBHOOK_RECOVERY_INTERVAL_MS = 60 * 1000;
const WEBHOOK_RECOVERY_BATCH_SIZE = 10;

let recoveryInterval = null;
let isRunning = false;

async function runWebhookRecovery() {
  if (isRunning) {
    return;
  }

  isRunning = true;

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
    isRunning = false;
  }
}

export function startWebhookRecoveryWorker() {
  if (recoveryInterval) {
    return stopWebhookRecoveryWorker;
  }

  console.log("Webhook recovery worker started.");

  // Run once immediately after startup.
  void runWebhookRecovery();

  recoveryInterval = setInterval(
    runWebhookRecovery,
    WEBHOOK_RECOVERY_INTERVAL_MS,
  );

  return stopWebhookRecoveryWorker;
}

export function stopWebhookRecoveryWorker() {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = null;
  }

  console.log("Webhook recovery worker stopped.");
}
