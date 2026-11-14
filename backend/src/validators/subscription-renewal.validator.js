import { z } from "zod";

export const createSubscriptionRenewalSchema = z
  .object({
    billingInterval: z.enum(["monthly", "yearly"]),
  })
  .strict();

export const subscriptionRenewalParamsSchema = z
  .object({
    organizationId: z.string().regex(/^[a-f\d]{24}$/i),
  })
  .strict();
