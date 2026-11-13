import { z } from "zod";

export const createOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Organization name must contain at least 2 characters")
      .max(150, "Organization name cannot exceed 150 characters"),
  })
  .strict();
