import { z } from "zod";

const ageSchema = z.union([z.number().int(), z.string().trim().min(1)]);

const dateSchema = (field: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${field} must be YYYY-MM-DD`);

export const createDriverSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().min(7).max(20).optional(),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase())
    .optional(),
  dateOfBirth: dateSchema("dateOfBirth"),
  age: ageSchema,
  licenseNumber: z.string().trim().min(3).max(30),
  licenseState: z.string().trim().min(2).max(20),
  licenseExpiry: dateSchema("licenseExpiry"),
});

export const updateDriverSchema = createDriverSchema.partial();

export const assignDriverSchema = z.object({
  driverId: z.string().trim().min(1).nullable(),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;
export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
