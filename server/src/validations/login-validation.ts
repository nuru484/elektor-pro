// src/validation/authentication/loginValidation.ts (backend)
import { z } from 'zod';

export const isPhoneNumber = (value: string): boolean => {
  return /^[\d\s+\-()]+$/.test(value);
};

export const loginSchema = z.object({
  emailOrPhone: z.string().min(1, { message: 'Email or phone number is required' }),
  password: z.string().min(4, { message: 'Password must be at least 4 characters' }).max(255, { message: 'Password must be 255 characters or less' }),
});
