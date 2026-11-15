import mongoose from "mongoose";

import connectDB from "../config/database.js";
import { processSubscriptionLifecycle } from "../services/subscription-lifecycle.service.js";

const dryRun = process.argv.includes("--dry-run");

const atIndex = process.argv.indexOf("--at");
const atValue = atIndex !== -1 ? process.argv[atIndex + 1] : null;

// Simulated dates are allowed only in dry-run mode.
if (atValue && !dryRun) {
  throw new Error("--at can only be used together with --dry-run");
}

const simulatedDate = atValue ? new Date(atValue) : undefined;

if (atValue && Number.isNaN(simulatedDate.getTime())) {
  throw new Error("INVALID_SIMULATION_DATE");
}

async function main() {
  try {
    await connectDB();

    const result = await processSubscriptionLifecycle({
      dryRun,
      ...(simulatedDate ? { now: simulatedDate } : {}),
    });

    console.log(
      "Subscription lifecycle processing completed:",
      JSON.stringify(result, null, 2),
    );
  } catch (error) {
    console.error("Subscription lifecycle processing failed:", error.message);

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

main();
