// src/validations/auth-validation.ts
// Mirrors the backend's src/validations/auth-validation.ts so client-side
// feedback matches exactly what the server enforces.
import { z } from "zod";

export const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "Email or phone number is required"),
  password: z.string().min(4, "Password is too short").max(255),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const strongPassword = z
  .string()
  .min(8, "At least 8 characters")
  .max(255)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

export const changePasswordSchema = z
  .object({
    confirmPassword: z.string(),
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: strongPassword,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  emailOrPhone: z.string().min(1, "Enter your email or phone number"),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    confirmPassword: z.string(),
    newPassword: strongPassword,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().min(1, "Last name is required").max(80),
});
export type UpdateProfileValues = z.infer<typeof updateProfileSchema>;

export const emailChangeSchema = z.object({
  email: z.email("Enter a valid email address").max(255),
});
export type EmailChangeValues = z.infer<typeof emailChangeSchema>;

export const phoneChangeSchema = z.object({
  phone: z.string().min(6, "Enter a valid phone number").max(20),
});
export type PhoneChangeValues = z.infer<typeof phoneChangeSchema>;

export const otpCodeSchema = z.object({
  code: z.string().min(4, "Enter the code").max(10),
});
export type OtpCodeValues = z.infer<typeof otpCodeSchema>;
