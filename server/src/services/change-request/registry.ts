// src/services/change-request/registry.ts
// Maps each governed entity to its create/update/remove appliers. Domain
// services register here; the engine looks an applier up to apply a staged or
// direct change. Entries are added as each domain module lands.
//
// AGENT and USER are DELIBERATELY absent: agent assignments and user accounts
// are managed directly by privileged roles (governance.service /
// user-admin.service, both audited) and never ride maker-checker - account
// changes have side effects (sessions, credentials) a replayed JSON payload
// cannot safely express. proposeOrExecute rejects those entities up front
// ("Unsupported entity"), so a change request for them can never be staged.
import type { ChangeEntity } from '../../../generated/prisma/client.js';
import type { Applier } from './types.js';

import { candidateApplier } from '../domain/candidate.service.js';
import { electionApplier } from '../domain/election.service.js';
import { groupApplier, groupCategoryApplier } from '../domain/group.service.js';
import { organizationApplier } from '../domain/organization.service.js';
import { portfolioApplier } from '../domain/portfolio.service.js';
import { voterApplier } from '../domain/voter.service.js';

export const appliers: Partial<Record<ChangeEntity, Applier>> = {
  CANDIDATE: candidateApplier,
  ELECTION: electionApplier,
  GROUP: groupApplier,
  GROUP_CATEGORY: groupCategoryApplier,
  ORGANIZATION: organizationApplier,
  PORTFOLIO: portfolioApplier,
  VOTER: voterApplier,
};
