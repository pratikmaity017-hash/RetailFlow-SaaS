import { z } from "zod";

const paymentAmountSchema = z
  .number()
  .positive("Payment amount must be greater than zero")
  .max(Number.MAX_SAFE_INTEGER / 100, "Payment amount is too large")
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
    "Payment amount can have at most 2 decimal places",
  );

export const createPaymentSchema = z
  .object({
    amount: paymentAmountSchema,

    method: z.enum(["cash", "card", "upi", "bank_transfer", "other"]),

    reference: z
      .string()
      .trim()
      .max(100, "Reference cannot exceed 100 characters")
      .optional(),

    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .optional(),
  })
  .strict();
