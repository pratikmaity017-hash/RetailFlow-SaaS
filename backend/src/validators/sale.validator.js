import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID format");

const saleItemSchema = z.object({
  variantId: objectIdSchema,

  quantity: z
    .number()
    .positive("Quantity must be greater than zero")
    .max(1000000, "Quantity is too large")
    .refine(
      (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7,
      "Quantity can have at most 3 decimal places",
    ),
});
export const createSaleSchema = z
  .object({
    customerId: objectIdSchema.nullable().optional(),

    items: z
      .array(saleItemSchema)
      .min(1, "A sale must contain at least one item")
      .max(100, "A sale cannot contain more than 100 items"),

    notes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      const variantIds = data.items.map((item) => item.variantId);
      return new Set(variantIds).size === variantIds.length;
    },
    {
      message: "A product variant can only appear once in a sale",
      path: ["items"],
    },
  );

export const cancelSaleSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(3, "Cancellation reason must contain at least 3 characters")
      .max(500, "Cancellation reason cannot exceed 500 characters"),
  })
  .strict();
