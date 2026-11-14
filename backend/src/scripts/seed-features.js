import mongoose from "mongoose";

import connectDB from "../config/database.js";
import Feature from "../models/feature.model.js";

const features = [
  // Core Retail Features
  {
    code: "product_management",
    name: "Product Management",
    description: "Create, update and manage retail products and variants.",
    type: "core",
    sortOrder: 1,
  },
  {
    code: "inventory_management",
    name: "Inventory Management",
    description: "Track product stock and inventory movements.",
    type: "core",
    sortOrder: 2,
  },
  {
    code: "sales_management",
    name: "Sales Management",
    description: "Create and manage retail sales and transactions.",
    type: "core",
    sortOrder: 3,
  },
  {
    code: "customer_management",
    name: "Customer Management",
    description: "Manage customer profiles and purchase information.",
    type: "core",
    sortOrder: 4,
  },
  {
    code: "supplier_management",
    name: "Supplier Management",
    description: "Manage supplier profiles and relationships.",
    type: "core",
    sortOrder: 5,
  },
  {
    code: "purchase_management",
    name: "Purchase Management",
    description: "Manage stock purchases and supplier purchases.",
    type: "core",
    sortOrder: 6,
  },
  {
    code: "sales_reports",
    name: "Sales Reports",
    description: "View basic sales reports and summaries.",
    type: "core",
    sortOrder: 7,
  },
  {
    code: "returns_management",
    name: "Returns Management",
    description: "Manage customer product returns.",
    type: "core",
    sortOrder: 8,
  },

  // Advanced Retail Features
  {
    code: "advanced_analytics",
    name: "Advanced Analytics",
    description: "Access advanced business analytics and insights.",
    type: "advanced",
    sortOrder: 20,
  },
  {
    code: "warehouse_management",
    name: "Warehouse Management",
    description: "Manage warehouses and stock across locations.",
    type: "advanced",
    sortOrder: 21,
  },
  {
    code: "product_exchange",
    name: "Product Exchange",
    description: "Manage customer product exchange workflows.",
    type: "advanced",
    sortOrder: 22,
  },
  {
    code: "advanced_inventory_reports",
    name: "Advanced Inventory Reports",
    description: "Access detailed inventory analysis and reports.",
    type: "advanced",
    sortOrder: 23,
  },
];

async function seedFeatures() {
  console.log("\nFeature Seed Started");

  await connectDB();

  console.log("MongoDB connected.");

  const operations = features.map((feature) => ({
    updateOne: {
      filter: { code: feature.code },
      update: {
        $setOnInsert: feature,
      },
      upsert: true,
    },
  }));

  const result = await Feature.bulkWrite(operations);

  console.log("\n---------- SEED RESULT ----------");
  console.log(`Features in catalog: ${features.length}`);
  console.log(`Inserted: ${result.upsertedCount}`);
  console.log(`Already existed: ${features.length - result.upsertedCount}`);
  console.log("\nFeature Seed Completed.");
}

seedFeatures()
  .catch((error) => {
    console.error("\nSEED ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  });
