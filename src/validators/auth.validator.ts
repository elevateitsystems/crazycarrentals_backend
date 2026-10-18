import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(72),
});

export const forgetPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  id: z.string(),
  otp: z.number().int().min(1000).max(9999),
  newPassword: z.string().min(8).max(72),
});

export const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(8).max(72),
    newPassword: z.string().min(8).max(72),
    confirmPassword: z.string().min(8).max(72),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phoneNumber: z.string().trim().min(10).max(15).optional(),
  avatarUrl: z.string().url().optional(),
  address: z.string().trim().min(2).max(255).optional(),
});

export const adminUpdateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .transform((value) => value.toLowerCase())
    .optional(),
  role: z.enum(["USER", "ADMIN", "SUPER_ADMIN"]).optional(),
  phoneNumber: z.string().trim().min(7).max(20).optional(),
  avatarUrl: z.string().url().optional(),
  address: z.string().trim().min(2).max(255).optional(),
  isEmailVerified: z.boolean().optional(),
  unlockAccount: z.boolean().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgetPasswordInput = z.infer<typeof forgetPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

