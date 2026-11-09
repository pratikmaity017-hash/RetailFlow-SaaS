import { z } from "zod";

export const createProductSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Product name must be at least 2 characters")
      .max(150, "Product name cannot exceed 150 characters"),

    description: z
      .string()
      .trim()
      .max(2000, "Description cannot exceed 2000 characters")
      .optional(),

    category: z
      .string()
      .trim()
      .max(100, "Category cannot exceed 100 characters")
      .optional(),

    brand: z
      .string()
      .trim()
      .max(100, "Brand cannot exceed 100 characters")
      .optional(),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().max(2000).optional(),
    category: z.string().trim().max(100).optional(),
    brand: z.string().trim().max(100).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update a product",
  });
