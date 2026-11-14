import { z } from "zod";

const supplierAddressSchema = z
  .object({
    street: z.string().trim().max(150).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
  })
  .strict();

export const createSupplierSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Supplier name must be at least 2 characters")
      .max(150, "Supplier name cannot exceed 150 characters"),

    contactPerson: z
      .string()
      .trim()
      .max(100, "Contact person cannot exceed 100 characters")
      .optional(),

    phone: z
      .string()
      .trim()
      .max(20, "Phone cannot exceed 20 characters")
      .optional(),

    alternatePhone: z
      .string()
      .trim()
      .max(20, "Alternate phone cannot exceed 20 characters")
      .optional(),

    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(254, "Email cannot exceed 254 characters")
      .optional(),

    address: supplierAddressSchema.optional(),

    gstin: z
      .string()
      .trim()
      .max(15, "GSTIN cannot exceed 15 characters")
      .transform((value) => value.toUpperCase())
      .optional(),

    pan: z
      .string()
      .trim()
      .max(10, "PAN cannot exceed 10 characters")
      .transform((value) => value.toUpperCase())
      .optional(),

    notes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional(),
  })
  .strict();

export const updateSupplierSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),

    contactPerson: z.string().trim().max(100).nullable().optional(),

    phone: z.string().trim().max(20).nullable().optional(),

    alternatePhone: z.string().trim().max(20).nullable().optional(),

    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(254)
      .nullable()
      .optional(),

    address: supplierAddressSchema.nullable().optional(),

    gstin: z
      .string()
      .trim()
      .max(15)
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional(),

    pan: z
      .string()
      .trim()
      .max(10)
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional(),

    notes: z.string().trim().max(1000).nullable().optional(),

    status: z.enum(["active", "inactive"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required to update a supplier",
  });

export const listSuppliersQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(100, "Search cannot exceed 100 characters")
      .optional(),

    status: z.enum(["active", "inactive"]).optional(),

    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict();

export const supplierIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid supplier ID");

export const updateSupplierStatusSchema = z
  .object({
    status: z.enum(["active", "inactive"]),
  })
  .strict();
