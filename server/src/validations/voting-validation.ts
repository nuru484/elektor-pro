// src/validations/voting-validation.ts
import { z } from 'zod';

import { BallotEntryType } from '../../generated/prisma/client.js';

export const otpRequestSchema = z.object({
  identifier: z.string().min(1, { message: 'Voter ID or phone is required' }),
});

export const otpVerifySchema = z.object({
  code: z.string().min(4).max(10),
  identifier: z.string().min(1),
});

export const castBallotSchema = z.object({
  selections: z
    .array(
      z.object({
        approve: z.boolean().optional(),
        candidateIds: z.array(z.string()).max(50).optional(),
        portfolioId: z.string().min(1),
        type: z.enum(BallotEntryType).optional(),
      }),
    )
    .min(1),
});
