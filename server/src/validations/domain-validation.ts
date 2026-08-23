// src/validations/domain-validation.ts
import { z } from 'zod';

import {
  CandidateStatus,
  ElectionStatus,
  EligibilityMode,
  PortfolioEligibilityMode,
  ResultsPolicy,
  VotingMethod,
} from '../../generated/prisma/client.js';
import { jsonRecord } from './common.js';

// --- Organization ---
export const updateOrganizationSchema = z.object({
  // logoUrl/faviconUrl deliberately absent: branding media URLs may only
  // originate from the upload endpoints, never from a request body.
  //
  // Colours are absent by design, not oversight. Two free-text hex values
  // cannot be held to a contrast ratio, and one pale accent silently breaks
  // every text/background pair the theme guarantees. Offering a choice means
  // offering pre-validated palettes, not a colour field.
  name: z.string().min(2).max(150).optional(),
  supportEmail: z.email().optional().nullable(),
  supportPhone: z.string().max(30).optional().nullable(),
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
// Multipart forms deliver a single checkbox as a bare string.
const idList = z.preprocess(
  (value) => (typeof value === 'string' ? [value] : value),
  z.array(z.string().min(1)).optional(),
);
const voterBase = z.object({
  electionIds: idList,
  email: z.email().optional().nullable(),
  groupIds: idList,
  metadata: jsonRecord.optional().nullable(),
  name: z.string().min(1).max(150),
  phoneNumber: z.string().min(6).max(20).optional().nullable(),
  voterId: z.string().min(1).max(60),
});
// A voter is always registered INTO at least one election; their groups within
// that election's scope come along on the same form.
export const createVoterSchema = voterBase.extend({
  electionIds: z.preprocess(
    (value) => (typeof value === 'string' ? [value] : value),
    z.array(z.string().min(1)).min(1, 'Select at least one election'),
  ),
});
export const updateVoterSchema = voterBase.partial();
// Bulk rows may omit elections: file imports register voters first and the
// roll/group tools place them afterwards.
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
  vettingEnabled: z.boolean().optional(),
  vettingPassPercent: z.number().int().min(1).max(100).optional().nullable(),
  voteCodeEnabled: z.boolean().optional(),
  // Open ballot: stores each voter's receipt against their record so they can
  // replay their own vote. Changes the election's TYPE, not just its display.
  voteVisibleToVoter: z.boolean().optional(),
});
export const createElectionSchema = electionBase.refine(
  (d) => d.endDate > d.startDate,
  { message: 'End date must be after start date', path: ['endDate'] },
);
// status may ride a general update so an admin can adjust the dates and the
// status in ONE submit ("bring the start forward and open now") - the service
// judges the transition against the new window.
export const updateElectionSchema = electionBase
  .extend({ status: z.enum(ElectionStatus).optional() })
  .partial()
  .refine((d) => !d.startDate || !d.endDate || d.endDate > d.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  });
export const electionStatusSchema = z.object({
  status: z.enum(ElectionStatus),
});
export const cloneElectionSchema = z
  .object({
    endDate: z.coerce.date(),
    name: z.string().min(2).max(150),
    slug: z.string().max(80).optional(),
    startDate: z.coerce.date(),
  })
  .refine((d) => d.endDate > d.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
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
  // Contact doubles as the candidate's sign-in identity: an account is
  // created (or linked) from it, so new nominations must carry at least one.
  email: z.email().optional().nullable(),
  manifesto: z.string().max(5000).optional().nullable(),
  name: z.string().min(1).max(150),
  nickname: z.string().max(120).optional().nullable(),
  order: z.number().int().min(0).optional(),
  partySymbol: z.string().max(300).optional().nullable(),
  phone: z.string().min(6).max(20).optional().nullable(),
  portfolioId: z.string().min(1),
  // profilePicture deliberately absent: media URLs may only originate from
  // the upload middleware, never from a request body.
});
export const allocateCandidatesSchema = z.object({
  candidateIds: z.array(z.string().min(1)).min(1).max(500),
  portfolioId: z.string().min(1),
});

const candidateWithContact = candidateBase.refine(
  (d) => Boolean(d.email) || Boolean(d.phone),
  {
    message: 'Provide an email or phone number so the candidate can sign in',
    path: ['email'],
  },
);
export const createCandidateSchema = candidateWithContact;
export const updateCandidateSchema = candidateBase.partial();
export const bulkCandidateSchema = z.object({
  candidates: z.array(candidateWithContact).min(1).max(1000),
});

// --- Vetting ---
const criterionBase = z.object({
  description: z.string().max(500).optional().nullable(),
  maxScore: z.number().int().min(1).max(100).optional(),
  name: z.string().min(1).max(120),
  order: z.number().int().min(0).optional(),
});
export const createCriterionSchema = criterionBase;
export const updateCriterionSchema = criterionBase.partial();
export const vettingScoreSchema = z.object({
  criterionId: z.string().min(1),
  note: z.string().max(1000).optional().nullable(),
  score: z.number().int().min(0),
});
export const candidateDecisionSchema = z.object({
  note: z.string().max(1000).optional().nullable(),
  status: z.enum(CandidateStatus),
});
export const ballotNumberSchema = z.object({
  ballotNumber: z.number().int().min(1).max(999).nullable(),
});
export const autoAssignSchema = z.object({
  strategy: z.enum(['ALPHABETICAL', 'SCORE']),
});

// --- Change requests ---
export const reviewChangeSchema = z.object({
  note: z.string().max(1000).optional(),
});
