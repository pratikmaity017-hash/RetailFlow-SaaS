import mongoose from "mongoose";

import connectDB from "../config/database.js";
import SubscriptionPlan from "../models/subscription-plan.model.js";

const plans = [
  {
    code: "free",
    name: "Free",
    description: "Free plan for small retail businesses.",

    // Free plan does not require paid billing.
    prices: {
      monthly: null,
      yearly: null,
    },

    entitlements: {
      features: {
        product_management: true,
        inventory_management: true,
        sales_management: true,
        customer_management: true,
        supplier_management: true,
        purchase_management: true,
        sales_reports: true,
        returns_management: true,

        advanced_analytics: false,
        warehouse_management: false,
        product_exchange: false,
        advanced_inventory_reports: false,
      },

      limits: {
        products: 100,
        staff: 2,
        suppliers: 10,
        customers: 100,
      },
    },

    isActive: true,
    sortOrder: 1,
  },
];

async function seedSubscriptionPlans() {
  console.log("\nSubscription Plan Seed Started");

  await connectDB();

  console.log("MongoDB connected.");

  const operations = plans.map((plan) => ({
    updateOne: {
      filter: { code: plan.code },
      update: {
        $setOnInsert: plan,
      },
      upsert: true,
    },
  }));

  const result = await SubscriptionPlan.bulkWrite(operations);

  console.log("\n---------- SEED RESULT ----------");
  console.log(`Plans in catalog: ${plans.length}`);
  console.log(`Inserted: ${result.upsertedCount}`);
  console.log(`Already existed: ${plans.length - result.upsertedCount}`);

  console.log("\nSubscription Plan Seed Completed.");
}

seedSubscriptionPlans()
  .catch((error) => {
    console.error("\nSEED ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  });
