import { z } from "zod";

export const stockAdjustmentSchema = z
  .object({
    type: z.enum(["stock_in", "stock_out", "adjustment"]),
    quantity: z.number().int().min(0),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()
  .refine(
    (data) => {
      return data.type === "adjustment" || data.quantity > 0;
    },
    {
      message: "Quantity must be greater than zero for stock_in and stock_out",
      path: ["quantity"],
    },
  );
