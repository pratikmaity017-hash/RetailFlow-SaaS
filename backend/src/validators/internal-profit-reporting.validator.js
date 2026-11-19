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

export const internalProfitReportingQuerySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
  })
  .strict()
  .refine((data) => data.from <= data.to, {
    message: "'from' date cannot be after 'to' date",
    path: ["from"],
  })
  .refine(
    (data) => {
      const from = new Date(`${data.from}T00:00:00.000Z`);
      const to = new Date(`${data.to}T00:00:00.000Z`);

      return (to.getTime() - from.getTime()) / 86400000 <= 365;
    },
    {
      message: "Reporting date range cannot exceed 366 days",
      path: ["to"],
    },
  );
