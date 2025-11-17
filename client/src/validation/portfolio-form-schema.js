import { z } from "zod";

// Define the form schema using Zod
export const portfolioFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Portfolio name is required." })
    .max(100, { message: "Portfolio name must be at most 100 characters." })
    .trim(),

  description: z
    .string()
    .max(300, { message: "Description must be at most 300 characters." })
    .optional(),

  electionId: z.string().refine((val) => !isNaN(parseInt(val)), {
    message: "Valid election ID is required.",
  }),
});
