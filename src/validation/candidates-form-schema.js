import { z } from "zod";

// Define the form schema using Zod
export const candidatesFormSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Candidate name is required." })
    .max(100, { message: "Candidate name is too long." })
    .trim(),

  // party: z
  //   .string()
  //   .min(1, { message: "Party name must have at least 1 character." })
  //   .max(100, { message: "Party name is too long." })
  //   .optional(),

  // partySymbol: z
  //   .string()
  //   .max(50, { message: "Party symbol is too long." })
  //   .optional(),

  electionId: z.string().refine((val) => !isNaN(parseInt(val)), {
    message: "Valid election ID is required.",
  }),

  portfolioId: z.string().refine((val) => !isNaN(parseInt(val)), {
    message: "Valid portfolio ID is required.",
  }),

  profilePicture: z.instanceof(File).optional().nullable(),
});
