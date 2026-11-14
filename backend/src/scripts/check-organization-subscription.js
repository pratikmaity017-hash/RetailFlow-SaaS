import mongoose from "mongoose";

import connectDB from "../config/database.js";
import Subscription from "../models/subscription.model.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";

async function checkSubscription() {
  await connectDB();

  // তোমার actual Organization ID বসাও।
  const organizationId = "6af85fc2288479fce214785f";

  const subscription = await Subscription.findOne({
    organization: organizationId,
  }).populate("plan");

  console.log("\n---------- SUBSCRIPTION CHECK ----------");

  if (!subscription) {
    console.log("No subscription found for this organization.");
    return;
  }

  console.log({
    organization: subscription.organization,
    status: subscription.status,
    plan: subscription.plan?.code,
    planActive: subscription.plan?.isActive,
    billingInterval: subscription.billingInterval,
    currentPeriodStart: subscription.currentPeriodStart,
  });
}

checkSubscription()
  .catch((error) => {
    console.error("ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
