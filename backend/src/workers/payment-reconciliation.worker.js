import { recoverPendingPaymentReconciliations } from "../services/subscription-payment.service.js";

const RECONCILIATION_INTERVAL_MS = 60 * 1000;
const RECONCILIATION_BATCH_SIZE = 10;

let reconciliationInterval = null;
let activeRun = null;

async function runPaymentReconciliation() {
  if (activeRun) {
    return activeRun;
  }

  activeRun = (async () => {
    try {
      const result = await recoverPendingPaymentReconciliations({
        batchSize: RECONCILIATION_BATCH_SIZE,
      });

      if (result.checked > 0) {
        console.log("Payment reconciliation completed:", result);
      }
    } catch (error) {
      console.error("Payment reconciliation worker error:", error.message);
    } finally {
      activeRun = null;
    }
  })();

  return activeRun;
}

export function startPaymentReconciliationWorker() {
  if (reconciliationInterval) {
    return stopPaymentReconciliationWorker;
  }

  console.log("Payment reconciliation worker started.");

  void runPaymentReconciliation();

  reconciliationInterval = setInterval(
    runPaymentReconciliation,
    RECONCILIATION_INTERVAL_MS,
  );

  return stopPaymentReconciliationWorker;
}

export async function stopPaymentReconciliationWorker() {
  if (reconciliationInterval) {
    clearInterval(reconciliationInterval);
    reconciliationInterval = null;
  }

  if (activeRun) {
    await activeRun;
  }

  console.log("Payment reconciliation worker stopped.");
}
