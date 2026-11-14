import { z } from "zod";

export const requestSubscriptionPlanChangeSchema = z
  .object({
    planCode: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(50)
      .regex(/^[a-z0-9_-]+$/),

    billingInterval: z.enum(["monthly", "yearly"]),
  })
  .strict();

export const subscriptionChangeParamsSchema = z
  .object({
    organizationId: z.string().regex(/^[a-f\d]{24}$/i),
  })
  .strict();
