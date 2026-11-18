import { z } from "zod";

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

const quantitySchema = z
  .number()
  .finite()
  .min(0.001)
  .max(999999999)
  .refine(
    (value) => Number(value.toFixed(3)) === value,
    "Quantity can have at most 3 decimal places",
  );

const returnItemSchema = z
  .object({
    saleItemId: objectIdSchema,
    quantity: quantitySchema,
    restock: z.boolean().optional().default(true),
  })
  .strict();

export const createReturnSchema = z
  .object({
    saleId: objectIdSchema,

    reason: z
      .string()
      .trim()
      .min(1, "Return reason is required")
      .max(500, "Return reason cannot exceed 500 characters"),

    notes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional()
      .default(""),

    items: z
      .array(returnItemSchema)
      .min(1, "At least one return item is required")
      .max(500, "Cannot exceed 500 return items"),
  })
  .strict()
  .refine(
    (data) =>
      new Set(data.items.map((item) => item.saleItemId)).size ===
      data.items.length,
    {
      message: "Duplicate sale item references are not allowed",
      path: ["items"],
    },
  );

export const processReturnSchema = z
  .object({
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export const returnIdSchema = objectIdSchema;
