import { z } from "zod";

export const createOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Organization name must contain at least 2 characters")
      .max(150, "Organization name cannot exceed 150 characters"),
  })
  .strict();

export const updateOrganizationCategoriesSchema = z
  .object({
    primaryCategory: z
      .string()
      .regex(/^[a-f\d]{24}$/i, "Invalid primary category ID"),

    additionalCategories: z
      .array(
        z.string().regex(/^[a-f\d]{24}$/i, "Invalid additional category ID"),
      )
      .max(30, "Cannot add more than 30 additional categories"),
  })
  .strict();
