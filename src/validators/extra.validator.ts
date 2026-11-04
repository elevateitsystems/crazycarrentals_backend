import { z } from "zod";

const pricePerDaySchema = z
  .number()
  .positive("pricePerDay must be greater than 0")
  .max(10000, "pricePerDay is too high");

export const createExtraSchema = z.object({
  name: z.string().trim().min(2).max(80),
  pricePerDay: pricePerDaySchema,
});

export const updateExtraSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    pricePerDay: pricePerDaySchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "No fields to update",
  });

export type CreateExtraInput = z.infer<typeof createExtraSchema>;
export type UpdateExtraInput = z.infer<typeof updateExtraSchema>;
