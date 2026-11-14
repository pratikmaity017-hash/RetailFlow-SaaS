import mongoose from "mongoose";

import connectDB from "../config/database.js";
import BusinessCategory from "../models/business-category.model.js";
import Feature from "../models/feature.model.js";
import BusinessCategoryFeature from "../models/business-category-feature.model.js";

const categorySlug = "general-retail";

const featureCodes = [
  // Core Features
  "product_management",
  "inventory_management",
  "sales_management",
  "customer_management",
  "supplier_management",
  "purchase_management",
  "sales_reports",
  "returns_management",

  // Advanced Features
  "advanced_analytics",
  "warehouse_management",
  "product_exchange",
  "advanced_inventory_reports",
];

async function seedBusinessCategoryFeatures() {
  console.log("\nBusiness Category Feature Seed Started");

  await connectDB();

  console.log("MongoDB connected.");

  const category = await BusinessCategory.findOne({
    slug: categorySlug,
    status: "active",
  }).select("_id name");

  if (!category) {
    throw new Error(`Active business category not found: ${categorySlug}`);
  }

  const features = await Feature.find({
    code: { $in: featureCodes },
    status: "active",
  }).select("_id code");

  const foundCodes = new Set(features.map((feature) => feature.code));

  const missingCodes = featureCodes.filter((code) => !foundCodes.has(code));

  if (missingCodes.length > 0) {
    throw new Error(
      `Features not found or inactive: ${missingCodes.join(", ")}`,
    );
  }

  const operations = features.map((feature) => ({
    updateOne: {
      filter: {
        businessCategory: category._id,
        feature: feature._id,
      },
      update: {
        $setOnInsert: {
          businessCategory: category._id,
          feature: feature._id,
          status: "active",
        },
      },
      upsert: true,
    },
  }));

  const result = await BusinessCategoryFeature.bulkWrite(operations);

  console.log("\n---------- SEED RESULT ----------");
  console.log(`Category: ${category.name}`);
  console.log(`Features mapped: ${features.length}`);
  console.log(`Inserted: ${result.upsertedCount}`);
  console.log(`Already existed: ${features.length - result.upsertedCount}`);

  console.log("\nBusiness Category Feature Seed Completed.");
}

seedBusinessCategoryFeatures()
  .catch((error) => {
    console.error("\nSEED ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  });
