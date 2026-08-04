// src/config/capabilities.ts
//
// The capability catalog: every capability with the label/description the
// console renders, grouped for the permissions matrix. This file is the
// single source of truth the frontend reads via GET /permissions - clients
// never hardcode capability strings.
import { Capability, Role } from '../../generated/prisma/client.js';

export interface ICapabilityGroup {
  capabilities: ICapabilityMeta[];
  group: string;
}

export interface ICapabilityMeta {
  capability: Capability;
  description: string;
  label: string;
}

export const CAPABILITY_CATALOG: ICapabilityGroup[] = [
  {
    capabilities: [
      {
        capability: Capability.MANAGE_ELECTIONS,
        description: 'Create and edit elections, schedules, and statuses.',
        label: 'Manage elections',
      },
      {
        capability: Capability.MANAGE_PORTFOLIOS,
        description: 'Create and edit the positions contested in an election.',
        label: 'Manage portfolios',
      },
      {
        capability: Capability.MANAGE_CANDIDATES,
        description: 'Add and edit candidates and their profiles.',
        label: 'Manage candidates',
      },
      {
        capability: Capability.VET_CANDIDATES,
        description:
          'Score nominations against the vetting criteria and decide who qualifies for the ballot.',
        label: 'Vet candidates',
      },
    ],
    group: 'Election setup',
  },
  {
    capabilities: [
      {
        capability: Capability.MANAGE_VOTERS,
        description: 'Add, edit, and import voters and their eligibility.',
        label: 'Manage voters',
      },
      {
        capability: Capability.MANAGE_AGENTS,
        description: 'Assign and manage candidate agents.',
        label: 'Manage agents',
      },
      {
        capability: Capability.MANAGE_GROUPS,
        description: 'Manage groups and categories used for eligibility.',
        label: 'Manage groups',
      },
    ],
    group: 'People',
  },
  {
    capabilities: [
      {
        capability: Capability.MANAGE_ORGANIZATION,
        description: 'Edit organization branding and settings.',
        label: 'Manage organization',
      },
      {
        capability: Capability.APPROVE_CHANGES,
        description:
          'Approve or reject staged change requests (maker-checker). Holders also apply their own changes directly.',
        label: 'Approve changes',
      },
    ],
    group: 'Governance',
  },
  {
    capabilities: [
      {
        capability: Capability.ACCREDIT_VOTERS,
        description: 'Accredit voters at the desk on election day.',
        label: 'Accredit voters',
      },
      {
        capability: Capability.VIEW_RESULTS,
        description: 'View live and final results dashboards.',
        label: 'View results',
      },
      {
        capability: Capability.CERTIFY_RESULTS,
        description: 'Publish results and certify the final count.',
        label: 'Certify results',
      },
    ],
    group: 'Election day & results',
  },
];

/** Roles whose capabilities the matrix can edit. SUPER_ADMIN implicitly holds
 * everything and VOTER never holds any - neither is stored or editable. */
export const EDITABLE_ROLES = [
  Role.ADMIN,
  Role.AGENT,
  Role.CANDIDATE,
  Role.ACCREDITOR,
] as const;

export type EditableRole = (typeof EDITABLE_ROLES)[number];

export const isEditableRole = (role: Role): role is EditableRole =>
  (EDITABLE_ROLES as readonly Role[]).includes(role);

/**
 * The shipped defaults. They seed the RoleCapability table (prisma/seed.ts
 * and the test reset) and act as the fallback while the table is completely
 * empty (a fresh deploy before its first seed).
 */
export const DEFAULT_ROLE_CAPABILITIES: Record<EditableRole, Capability[]> = {
  [Role.ACCREDITOR]: [Capability.ACCREDIT_VOTERS],
  [Role.ADMIN]: [
    Capability.MANAGE_ELECTIONS,
    Capability.MANAGE_PORTFOLIOS,
    Capability.MANAGE_CANDIDATES,
    Capability.MANAGE_VOTERS,
    Capability.MANAGE_AGENTS,
    Capability.MANAGE_GROUPS,
    Capability.MANAGE_ORGANIZATION,
    Capability.VET_CANDIDATES,
    Capability.ACCREDIT_VOTERS,
    Capability.VIEW_RESULTS,
  ],
  [Role.AGENT]: [Capability.VIEW_RESULTS],
  [Role.CANDIDATE]: [],
};
