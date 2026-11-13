import BusinessCategory from "../models/business-category.model.js";

export async function getActiveBusinessCategories() {
  return BusinessCategory.find({ status: "active" })
    .select("name slug description sortOrder")
    .sort({ sortOrder: 1, name: 1 })
    .lean();
}
