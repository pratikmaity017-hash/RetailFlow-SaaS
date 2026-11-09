import { z } from "zod";

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),

    email: z
      .string()
      .trim()
      .email("Please provide a valid email address")
      .max(254, "Email cannot exceed 254 characters"),

    password: z
      .string()
      .min(8, "Password must contain at least 8 characters")
      .max(72, "Password cannot exceed 72 characters"),

    organizationName: z
      .string()
      .trim()
      .min(2, "Organization name must contain at least 2 characters")
      .max(150, "Organization name cannot exceed 150 characters"),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email("Please provide a valid email address")
      .max(254, "Email cannot exceed 254 characters"),

    password: z
      .string()
      .min(1, "Password is required")
      .max(72, "Password cannot exceed 72 characters"),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  })
  .strict();
