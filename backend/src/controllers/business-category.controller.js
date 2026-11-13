import { getActiveBusinessCategories } from "../services/business-category.service.js";

export async function listBusinessCategories(req, res, next) {
  try {
    const categories = await getActiveBusinessCategories();

    return res.status(200).json({
      success: true,
      message: "Business categories fetched successfully",
      data: {
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
}
