import mongoose from "mongoose";

import connectDB from "../config/database.js";
import BusinessCategory from "../models/business-category.model.js";
import Feature from "../models/feature.model.js";
import BusinessCategoryFeature from "../models/business-category-feature.model.js";

// Map only implemented core retail features for now.
const coreFeatureCodes = [
  "product_management",
  "inventory_management",
  "sales_management",
  "customer_management",
  "supplier_management",
  "purchase_management",
  "sales_reports",
  "returns_management",
];

async function seedBusinessCategoryFeatures() {
  console.log("\nBusiness Category Feature Seed Started");

  await connectDB();

  console.log("MongoDB connected.");

  // Get all active business categories.
  const categories = await BusinessCategory.find({
    status: "active",
  }).select("_id name slug");

  if (categories.length === 0) {
    throw new Error("No active business categories found.");
  }

  // Get all required active core features.
  const features = await Feature.find({
    code: { $in: coreFeatureCodes },
    status: "active",
  }).select("_id code");

  const foundCodes = new Set(features.map((feature) => feature.code));

  const missingCodes = coreFeatureCodes.filter((code) => !foundCodes.has(code));

  if (missingCodes.length > 0) {
    throw new Error(
      `Core features not found or inactive: ${missingCodes.join(", ")}`,
    );
  }

  // Create a mapping for every active category and core feature.
  const operations = categories.flatMap((category) =>
    features.map((feature) => ({
      updateOne: {
        filter: {
          businessCategory: category._id,
          feature: feature._id,
        },
        update: {
          $set: {
            status: "active",
          },
          $setOnInsert: {
            businessCategory: category._id,
            feature: feature._id,
          },
        },
        upsert: true,
      },
    })),
  );

  const result = await BusinessCategoryFeature.bulkWrite(operations);

  console.log("\n---------- SEED RESULT ----------");
  console.log(`Active categories: ${categories.length}`);
  console.log(`Core features: ${features.length}`);
  console.log(`Total mappings checked: ${operations.length}`);
  console.log(`Inserted mappings: ${result.upsertedCount}`);
  console.log(`Reactivated/updated mappings: ${result.modifiedCount}`);

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
