import { z } from "zod";

// Define the form schema using Zod
export const electionFormSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: "Election name is required." })
      .max(100, { message: "Election name must be at most 100 characters." })
      .trim(),

    description: z
      .string()
      .max(300, { message: "Description must be at most 300 characters." })
      .optional(),

    startDate: z
      .string()
      .refine((val) => !val || !isNaN(new Date(val).getTime()), {
        message:
          "Invalid start date. Use ISO 8601 format (e.g., 2025-07-11T00:00:00Z).",
      })
      .optional(),

    endDate: z
      .string()
      .refine((val) => !val || !isNaN(new Date(val).getTime()), {
        message:
          "Invalid end date. Use ISO 8601 format (e.g., 2025-07-11T00:00:00Z).",
      })
      .optional(),

    status: z
      .enum(["UPCOMING", "IN_PROGRESS", "ENDED", "PAUSED", "CANCELLED"])
      .optional()
      .default("UPCOMING"),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;

      const start = new Date(data.startDate);
      const end = new Date(data.endDate);

      const startTime =
        start.getHours() * 3600 + start.getMinutes() * 60 + start.getSeconds();
      const endTime =
        end.getHours() * 3600 + end.getMinutes() * 60 + end.getSeconds();

      return endTime > startTime;
    },
    {
      message: "End time must be after start time.",
      path: ["endDate"],
    }
  );
