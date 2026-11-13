import { z } from "zod";

const customerAddressSchema = z
  .object({
    street: z.string().trim().max(150).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
  })
  .strict();

export const createCustomerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Customer name must be at least 2 characters")
      .max(150, "Customer name cannot exceed 150 characters"),

    phone: z
      .string()
      .trim()
      .max(20, "Phone cannot exceed 20 characters")
      .optional(),

    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(254, "Email cannot exceed 254 characters")
      .optional(),

    address: customerAddressSchema.optional(),

    notes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional(),
  })
  .strict();

export const updateCustomerSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),

    phone: z.string().trim().max(20).optional(),

    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(254)
      .nullable()
      .optional(),

    address: customerAddressSchema.optional(),

    notes: z.string().trim().max(1000).optional(),

    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update a customer",
  });
