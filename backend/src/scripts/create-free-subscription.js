import mongoose from "mongoose";

import connectDB from "../config/database.js";
import Organization from "../models/organization.model.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";
import Subscription from "../models/subscription.model.js";

async function createFreeSubscription() {
  await connectDB();

  // তোমার actual Organization ID বসাও।
  const organizationId = "6af85fc2288479fce214785f";

  const organization = await Organization.findOne({
    _id: organizationId,
    status: "active",
  });

  if (!organization) {
    throw new Error("Active organization not found.");
  }

  const existingSubscription = await Subscription.findOne({
    organization: organization._id,
  });

  if (existingSubscription) {
    console.log("Organization already has a subscription.");
    return;
  }

  const freePlan = await SubscriptionPlan.findOne({
    code: "free",
    isActive: true,
  });

  if (!freePlan) {
    throw new Error("Active Free Plan not found.");
  }

  const subscription = await Subscription.create({
    organization: organization._id,
    plan: freePlan._id,
    status: "active",
    billingInterval: "none",
    currentPeriodStart: new Date(),
    currentPeriodEnd: null,
  });

  console.log("\nFree Subscription Created Successfully.");

  console.log({
    organization: organization.name,
    plan: freePlan.code,
    subscriptionId: subscription._id.toString(),
    status: subscription.status,
  });
}

createFreeSubscription()
  .catch((error) => {
    console.error("\nERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  });
