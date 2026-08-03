// src/validations/auth-validation.ts
import { z } from 'zod';

export const loginSchema = z.object({
  emailOrPhone: z.string().min(1, { message: 'Email or phone number is required' }),
  password: z
    .string()
    .min(4, { message: 'Password must be at least 4 characters' })
    .max(255),
});

export const twoFactorVerifySchema = z.object({
  challengeToken: z.string().min(1, { message: 'Challenge token is required' }),
  code: z.string().min(6).max(12),
});

const strongPassword = z
  .string()
  .min(8, { message: 'Password must be at least 8 characters' })
  .max(255)
  .regex(/[a-z]/, { message: 'Include a lowercase letter' })
  .regex(/[A-Z]/, { message: 'Include an uppercase letter' })
  .regex(/[0-9]/, { message: 'Include a number' });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPassword,
});

export const forgotPasswordSchema = z.object({
  emailOrPhone: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  newPassword: strongPassword,
  token: z.string().min(1),
});

export const twoFactorActivateSchema = z.object({
  code: z.string().min(6).max(8),
});

export const twoFactorDisableSchema = z.object({
  password: z.string().min(1),
});

// --- Profile self-service ---

export const updateProfileSchema = z
  .object({
    firstName: z.string().min(1).max(80).trim().optional(),
    lastName: z.string().min(1).max(80).trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const requestEmailChangeSchema = z.object({
  email: z.email().max(255),
});

export const requestPhoneChangeSchema = z.object({
  phone: z.string().min(6).max(20),
});

export const confirmCodeSchema = z.object({
  code: z.string().min(4).max(10),
});
