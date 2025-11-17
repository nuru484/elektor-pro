import { z } from "zod";

export const SignupFormSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),

  email: z.string().email("Please enter a valid email address"),

  password: z.string().min(4, "Password must be at least 4 characters"),

  phone: z
    .string()
    .regex(/^\d{10,15}$/, "Phone number must be between 10 and 15 digits"),
});
