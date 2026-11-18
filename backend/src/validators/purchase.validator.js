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

const paiseSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const purchaseItemSchema = z
  .object({
    productId: objectIdSchema,

    variantId: objectIdSchema,

    quantity: quantitySchema,

    unitCostPaise: paiseSchema,

    discountPaise: paiseSchema.optional().default(0),

    taxPaise: paiseSchema.optional().default(0),
  })
  .strict();

export const createPurchaseSchema = z
  .object({
    supplierId: objectIdSchema,

    items: z
      .array(purchaseItemSchema)
      .min(1, "At least one purchase item is required")
      .max(500, "Cannot exceed 500 purchase items"),

    purchaseDate: z.coerce.date().optional(),

    supplierInvoiceNumber: z
      .string()
      .trim()
      .max(100, "Supplier invoice number cannot exceed 100 characters")
      .nullable()
      .optional(),

    notes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters")
      .nullable()
      .optional(),
  })
  .strict();

export const receivePurchaseSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            purchaseItemId: objectIdSchema,

            quantity: quantitySchema,
          })
          .strict(),
      )
      .min(1, "At least one receiving item is required")
      .max(500, "Cannot exceed 500 receiving items"),
  })
  .strict()
  .refine(
    (data) =>
      new Set(data.items.map((item) => item.purchaseItemId)).size ===
      data.items.length,
    {
      message: "Duplicate purchase item references are not allowed",
      path: ["items"],
    },
  );

export const cancelPurchaseSchema = z
  .object({
    cancellationReason: z
      .string()
      .trim()
      .min(1, "Cancellation reason is required")
      .max(500, "Cancellation reason cannot exceed 500 characters"),
  })
  .strict();

export const purchaseIdSchema = objectIdSchema;
