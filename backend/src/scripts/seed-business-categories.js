import mongoose from "mongoose";

import connectDB from "../config/database.js";
import BusinessCategory from "../models/business-category.model.js";

const categories = [
  {
    name: "General Retail",
    slug: "general-retail",
    description: "General merchandise and retail stores",
    sortOrder: 1,
  },
  {
    name: "Grocery & Supermarket",
    slug: "grocery-supermarket",
    description: "Grocery stores and supermarkets",
    sortOrder: 2,
  },
  {
    name: "Fashion & Clothing",
    slug: "fashion-clothing",
    description: "Clothing, apparel and fashion stores",
    sortOrder: 3,
  },
  {
    name: "Footwear",
    slug: "footwear",
    description: "Shoes, sandals and footwear stores",
    sortOrder: 4,
  },
  {
    name: "Electronics",
    slug: "electronics",
    description: "Consumer electronics and electrical products",
    sortOrder: 5,
  },
  {
    name: "Mobile & Accessories",
    slug: "mobile-accessories",
    description: "Mobile phones and mobile accessories",
    sortOrder: 6,
  },
  {
    name: "Pharmacy & Medical",
    slug: "pharmacy-medical",
    description: "Pharmacies and medical retail stores",
    sortOrder: 7,
  },
  {
    name: "Cosmetics & Beauty",
    slug: "cosmetics-beauty",
    description: "Cosmetics, skincare and beauty products",
    sortOrder: 8,
  },
  {
    name: "Hardware & Construction",
    slug: "hardware-construction",
    description: "Hardware, tools and construction materials",
    sortOrder: 9,
  },
  {
    name: "Books & Stationery",
    slug: "books-stationery",
    description: "Bookshops and stationery stores",
    sortOrder: 10,
  },
  {
    name: "Jewelry & Accessories",
    slug: "jewelry-accessories",
    description: "Jewelry and fashion accessories",
    sortOrder: 11,
  },
  {
    name: "Furniture",
    slug: "furniture",
    description: "Furniture and home furnishing stores",
    sortOrder: 12,
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    description: "Home appliances, kitchenware and household goods",
    sortOrder: 13,
  },
  {
    name: "Toys & Baby Products",
    slug: "toys-baby-products",
    description: "Toys, baby products and children's goods",
    sortOrder: 14,
  },
  {
    name: "Sports & Fitness",
    slug: "sports-fitness",
    description: "Sports equipment and fitness products",
    sortOrder: 15,
  },
  {
    name: "Automobile Parts",
    slug: "automobile-parts",
    description: "Automotive spare parts and accessories",
    sortOrder: 16,
  },
  {
    name: "Gift & Lifestyle",
    slug: "gift-lifestyle",
    description: "Gift items and lifestyle products",
    sortOrder: 17,
  },
  {
    name: "Food & Beverage",
    slug: "food-beverage",
    description: "Packaged food, beverages and related retail products",
    sortOrder: 18,
  },
];

async function seedBusinessCategories() {
  console.log("\nBusiness Category Seed Started");

  await connectDB();

  console.log("MongoDB connected.");

  const operations = categories.map((category) => ({
    updateOne: {
      filter: { slug: category.slug },
      update: {
        $setOnInsert: category,
      },
      upsert: true,
    },
  }));

  const result = await BusinessCategory.bulkWrite(operations);

  console.log("\n---------- SEED RESULT ----------");
  console.log(`Categories in catalog: ${categories.length}`);
  console.log(`Inserted: ${result.upsertedCount}`);
  console.log(`Already existed: ${categories.length - result.upsertedCount}`);
  console.log("\nBusiness Category Seed Completed.");
}

seedBusinessCategories()
  .catch((error) => {
    console.error("\nSEED ERROR:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("MongoDB disconnected.");
  });
