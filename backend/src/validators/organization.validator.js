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

export const updateOrganizationProfileSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Organization name must contain at least 2 characters")
      .max(150, "Organization name cannot exceed 150 characters")
      .optional(),

    email: z
      .string()
      .trim()
      .email("Invalid organization email")
      .max(254, "Organization email cannot exceed 254 characters")
      .optional(),

    phone: z
      .string()
      .trim()
      .max(20, "Phone number cannot exceed 20 characters")
      .optional(),

    address: z
      .object({
        street: z.string().trim().max(150).optional(),
        city: z.string().trim().max(100).optional(),
        state: z.string().trim().max(100).optional(),
        postalCode: z.string().trim().max(20).optional(),
        country: z.string().trim().max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one profile field must be provided",
  });
