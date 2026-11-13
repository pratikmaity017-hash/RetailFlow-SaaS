import { z } from "zod";

const quantitySchema = z
  .number()
  .min(0, "Quantity cannot be negative")
  .refine(
    (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7,
    "Quantity can have at most 3 decimal places",
  );

export const stockAdjustmentSchema = z
  .object({
    type: z.enum(["stock_in", "stock_out", "adjustment"]),

    quantity: quantitySchema,

    reason: z.string().trim().min(3).max(500),
  })
  .strict()
  .refine((data) => data.type === "adjustment" || data.quantity > 0, {
    message: "Quantity must be greater than zero for stock_in and stock_out",
    path: ["quantity"],
  });
