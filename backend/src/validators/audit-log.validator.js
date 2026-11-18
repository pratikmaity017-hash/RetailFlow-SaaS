import { z } from "zod";

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Invalid calendar date");

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

export const auditLogQuerySchema = z
  .object({
    action: z.string().trim().min(1).max(100).optional(),

    resourceType: z.string().trim().min(1).max(50).optional(),

    actorId: objectIdSchema.optional(),

    resourceId: objectIdSchema.optional(),

    from: dateSchema.optional(),

    to: dateSchema.optional(),

    page: z.coerce.number().int().min(1).max(100_000).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((data) => !data.from || !data.to || data.from <= data.to, {
    message: "'from' date cannot be after 'to' date",
    path: ["from"],
  })
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;

      const from = new Date(`${data.from}T00:00:00.000Z`);
      const to = new Date(`${data.to}T00:00:00.000Z`);

      return (to.getTime() - from.getTime()) / 86400000 <= 365;
    },
    {
      message: "Date range cannot exceed 366 days",
      path: ["to"],
    },
  );
