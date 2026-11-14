import mongoose from "mongoose";

import connectDB from "../config/database.js";
import Organization from "../models/organization.model.js";
import BusinessCategory from "../models/business-category.model.js";

async function checkOrganizationCategory() {
  await connectDB();

  // তোমার actual Organization ID এখানে বসাও।
  const organizationId = "6af81c02c0fc9909d1a1c425";

  const organization = await Organization.findById(organizationId)
    .populate("primaryCategory", "name slug status")
    .populate("additionalCategories", "name slug status");

  if (!organization) {
    console.log("Organization not found.");
    return;
  }

  console.log("\n---------- ORGANIZATION CATEGORY ----------");

  console.log({
    organizationName: organization.name,
    primaryCategory: organization.primaryCategory,
    additionalCategories: organization.additionalCategories,
  });
}

checkOrganizationCategory()
  .catch((error) => {
    console.error("ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
