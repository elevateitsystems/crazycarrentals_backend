import { z } from "zod";

const dateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const priceSchema = z.number().positive().max(10000);

const rateSchema = z.object({
  date: dateSchema,
  price: priceSchema.nullable(),
});

const rangeSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    price: priceSchema,
  })
  .refine((value) => value.from <= value.to, {
    message: "Range end cannot be earlier than the start",
    path: ["to"],
  });

export const setCarDailyRatesSchema = z
  .object({
    rates: z.array(rateSchema).max(400).optional().default([]),
    ranges: z.array(rangeSchema).max(40).optional().default([]),
  })
  .refine((value) => value.rates.length > 0 || value.ranges.length > 0, {
    message: "Add at least one date or date range",
  });

export type SetCarDailyRatesInput = z.infer<typeof setCarDailyRatesSchema>;
