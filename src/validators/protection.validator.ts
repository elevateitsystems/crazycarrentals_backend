import { z } from "zod";

const pricePerDaySchema = z
  .number()
  .min(0, "pricePerDay cannot be negative")
  .max(10000, "pricePerDay is too high");

const moneySchema = z.number().min(0).max(100000);

const coverageSchema = z.array(z.string().trim().min(1).max(120)).max(30);

export const createProtectionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  pricePerDay: pricePerDaySchema,
  isPopular: z.boolean().optional().default(false),
  included: coverageSchema.optional().default([]),
  excluded: coverageSchema.optional().default([]),
  excessLabel: z.string().trim().min(2).max(80).optional(),
  excessOver25: z.string().trim().max(40).optional(),
  excessUnder25: z.string().trim().max(40).optional(),
  bondCredit: moneySchema.optional(),
  bondDebit: moneySchema.optional(),
});

export const updateProtectionSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    pricePerDay: pricePerDaySchema.optional(),
    isActive: z.boolean().optional(),
    isPopular: z.boolean().optional(),
    included: coverageSchema.optional(),
    excluded: coverageSchema.optional(),
    excessLabel: z.string().trim().min(2).max(80).optional(),
    excessOver25: z.string().trim().max(40).optional(),
    excessUnder25: z.string().trim().max(40).optional(),
    bondCredit: moneySchema.optional(),
    bondDebit: moneySchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No fields to update",
  });

export type CreateProtectionInput = z.infer<typeof createProtectionSchema>;
export type UpdateProtectionInput = z.infer<typeof updateProtectionSchema>;
