// src/validations/domain-validation.ts
import { z } from 'zod';

import {
  ElectionStatus,
  EligibilityMode,
  PortfolioEligibilityMode,
  ResultsPolicy,
  VotingMethod,
} from '../../generated/prisma/client.js';
import { jsonRecord } from './common.js';

// --- Organization ---
export const updateOrganizationSchema = z.object({
  accentColor: z.string().max(20).optional(),
  // logoUrl/faviconUrl deliberately absent: branding media URLs may only
  // originate from the upload endpoints, never from a request body.
  locale: z.string().max(10).optional(),
  name: z.string().min(2).max(150).optional(),
  primaryColor: z.string().max(20).optional(),
  settings: jsonRecord.optional().nullable(),
  supportEmail: z.email().optional().nullable(),
  supportPhone: z.string().max(30).optional().nullable(),
  timezone: z.string().max(60).optional(),
  website: z.url().optional().nullable(),
});

// --- Group categories ---
export const createGroupCategorySchema = z.object({
  allowMultiple: z.boolean().optional(),
  code: z.string().min(1).max(40),
  description: z.string().max(500).optional(),
  name: z.string().min(1).max(80),
  order: z.number().int().min(0).optional(),
});
export const updateGroupCategorySchema = createGroupCategorySchema.partial();

// --- Groups ---
export const createGroupSchema = z.object({
  categoryId: z.string().min(1),
  code: z.string().min(1).max(40),
  description: z.string().max(500).optional(),
  name: z.string().min(1).max(120),
  parentId: z.string().optional().nullable(),
});
export const updateGroupSchema = createGroupSchema.partial();

// --- Voters ---
const voterBase = z.object({
  email: z.email().optional().nullable(),
  // Multipart forms deliver a single checkbox as a bare string.
  groupIds: z.preprocess(
    (value) => (typeof value === 'string' ? [value] : value),
    z.array(z.string()).optional(),
  ),
  metadata: jsonRecord.optional().nullable(),
  name: z.string().min(1).max(150),
  phoneNumber: z.string().min(6).max(20).optional().nullable(),
  voterId: z.string().min(1).max(60),
});
export const createVoterSchema = voterBase;
export const updateVoterSchema = voterBase.partial();
export const bulkVoterSchema = z.object({
  voters: z.array(voterBase).min(1).max(5000),
});

// --- Elections ---
const electionBase = z.object({
  accreditationRequired: z.boolean().optional(),
  description: z.string().max(2000).optional().nullable(),
  eligibilityMode: z.enum(EligibilityMode).optional(),
  endDate: z.coerce.date(),
  // Eligibility groups for GROUPS mode (replaced as a set on update).
  groupIds: z.array(z.string()).max(100).optional(),
  name: z.string().min(2).max(150),
  resultsPolicy: z.enum(ResultsPolicy).optional(),
  settings: jsonRecord.optional().nullable(),
  slug: z.string().max(80).optional(),
  startDate: z.coerce.date(),
});
export const createElectionSchema = electionBase.refine(
  (d) => d.endDate > d.startDate,
  { message: 'End date must be after start date', path: ['endDate'] },
);
export const updateElectionSchema = electionBase.partial().refine(
  (d) => !d.startDate || !d.endDate || d.endDate > d.startDate,
  { message: 'End date must be after start date', path: ['endDate'] },
);
export const electionStatusSchema = z.object({
  status: z.enum(ElectionStatus),
});
export const electionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  search: z.string().max(120).optional(),
  status: z.enum(ElectionStatus).optional(),
});

// --- Portfolios ---
const portfolioBase = z.object({
  allowAbstain: z.boolean().optional(),
  description: z.string().max(1000).optional().nullable(),
  electionId: z.string().min(1),
  eligibility: z.enum(PortfolioEligibilityMode).optional(),
  groupIds: z.array(z.string()).optional(),
  maxSelections: z.number().int().min(1).max(50).optional(),
  name: z.string().min(1).max(150),
  order: z.number().int().min(0).optional(),
  votingMethod: z.enum(VotingMethod).optional(),
});
export const createPortfolioSchema = portfolioBase;
export const updatePortfolioSchema = portfolioBase.partial();

// --- Candidates ---
const candidateBase = z.object({
  electionId: z.string().min(1),
  manifesto: z.string().max(5000).optional().nullable(),
  name: z.string().min(1).max(150),
  nickname: z.string().max(120).optional().nullable(),
  order: z.number().int().min(0).optional(),
  partySymbol: z.string().max(300).optional().nullable(),
  portfolioId: z.string().min(1),
  // profilePicture deliberately absent: media URLs may only originate from
  // the upload middleware, never from a request body.
});
export const createCandidateSchema = candidateBase;
export const updateCandidateSchema = candidateBase.partial();

// --- Change requests ---
export const reviewChangeSchema = z.object({
  note: z.string().max(1000).optional(),
});
