import { z } from "zod";

export const processRefundSchema = z
  .object({
    method: z.enum(["cash", "upi", "card", "bank_transfer", "other"]),

    reference: z
      .string()
      .trim()
      .max(100, "Reference cannot exceed 100 characters")
      .nullable()
      .optional(),

    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .nullable()
      .optional(),
  })
  .strict();
