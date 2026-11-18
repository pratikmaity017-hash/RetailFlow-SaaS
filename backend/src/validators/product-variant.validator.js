import { z } from "zod";

const attributesSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(50)
      .regex(/^[A-Za-z][A-Za-z0-9 _-]*$/),
    z.union([z.string().max(200), z.number().finite(), z.boolean()]),
  )
  .refine((attributes) => Object.keys(attributes).length <= 30, {
    message: "Cannot provide more than 30 product attributes",
  });

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

    attributes: attributesSchema.optional(),

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

    attributes: attributesSchema.optional(),

    costPrice: z.number().finite().min(0).optional(),

    sellingPrice: z.number().finite().min(0).optional(),

    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update a variant",
  });
