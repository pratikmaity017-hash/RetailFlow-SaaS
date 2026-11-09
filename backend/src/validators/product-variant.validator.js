import { z } from "zod";

export const createProductVariantSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .min(1, "SKU is required")
      .max(100, "SKU cannot exceed 100 characters"),

    barcode: z
      .string()
      .trim()
      .max(100, "Barcode cannot exceed 100 characters")
      .optional(),

    attributes: z.record(z.string(), z.unknown()).optional(),

    costPrice: z.number().finite().min(0, "Cost price cannot be negative"),

    sellingPrice: z
      .number()
      .finite()
      .min(0, "Selling price cannot be negative"),
  })
  .strict();

export const updateProductVariantSchema = z
  .object({
    sku: z.string().trim().min(1).max(100).optional(),
    barcode: z.string().trim().max(100).nullable().optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    costPrice: z.number().finite().min(0).optional(),
    sellingPrice: z.number().finite().min(0).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update a variant",
  });
