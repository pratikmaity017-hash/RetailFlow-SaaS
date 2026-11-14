import { z } from "zod";

export const verifySubscriptionPaymentSchema = z
  .object({
    orderId: z.string().trim().min(1).max(100),
    paymentId: z.string().trim().min(1).max(100),
    signature: z.string().regex(/^[a-f\d]{64}$/i),
  })
  .strict();

export const subscriptionPaymentParamsSchema = z
  .object({
    organizationId: z.string().regex(/^[a-f\d]{24}$/i),
  })
  .strict();

export const recoverSubscriptionPaymentSchema = z
  .object({
    orderId: z.string().trim().min(1).max(100),
  })
  .strict();
