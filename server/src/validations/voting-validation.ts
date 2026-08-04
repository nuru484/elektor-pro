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

export const rollAddSchema = z
  .object({
    groupId: z.string().min(1).optional(),
    voterIds: z.array(z.string().min(1)).max(5000).optional(),
  })
  .refine((d) => Boolean(d.groupId) || Boolean(d.voterIds?.length), {
    message: 'Provide voterIds, a groupId, or both',
    path: ['voterIds'],
  });

export const rollEligibilitySchema = z.object({
  isEligible: z.boolean(),
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
