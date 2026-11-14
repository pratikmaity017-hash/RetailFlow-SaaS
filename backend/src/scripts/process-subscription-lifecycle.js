import mongoose from "mongoose";

import connectDB from "../config/database.js";
import { processSubscriptionLifecycle } from "../services/subscription-lifecycle.service.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  try {
    await connectDB();

    const result = await processSubscriptionLifecycle({
      dryRun,
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
