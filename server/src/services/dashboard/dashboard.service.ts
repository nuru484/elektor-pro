import {
  ChangeStatus,
  ElectionStatus,
  type Prisma,
  Role,
} from '../../../generated/prisma/client.js';
// src/services/dashboard/dashboard.service.ts
import prisma from '../../lib/prisma.js';
import { buildMeta, type PaginationParams } from '../../utils/http.js';

/** Aggregate counts + recent activity for the admin dashboard. */
export const getAdminDashboard = async () => {
  const [
    totalElections,
    activeElections,
    totalVoters,
    totalCandidates,
    pendingChanges,
    recentActivity,
    recentElections,
  ] = await Promise.all([
    prisma.election.count(),
    prisma.election.count({ where: { status: ElectionStatus.IN_PROGRESS } }),
    prisma.voter.count(),
    prisma.candidate.count(),
    prisma.changeRequest.count({ where: { status: ChangeStatus.PENDING } }),
    prisma.auditLog.findMany({
      include: { actor: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { sequence: 'desc' },
      take: 10,
    }),
    prisma.election.findMany({
      include: { _count: { select: { candidates: true, portfolios: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return {
    recentActivity,
    recentElections,
    stats: {
      activeElections,
      pendingChanges,
      totalCandidates,
      totalElections,
      totalVoters,
    },
  };
};

/**
 * Elections + assignments visible to an agent, with everything they watch
 * for: their candidate's full card (portfolio, ballot number, status, photo)
 * and the election's shape (window, registered voters, candidate and
 * portfolio counts). Live turnout rides the separate polling endpoint.
 */
export const getAgentDashboard = async (
  userId: string,
  filters: { from?: Date; search?: string; to?: Date },
  pagination: PaginationParams,
) => {
  const where: Prisma.AgentAssignmentWhereInput = {
    election: {
      ...(filters.search
        ? { name: { contains: filters.search, mode: 'insensitive' } }
        : {}),
      ...(filters.from ? { endDate: { gte: filters.from } } : {}),
      ...(filters.to ? { startDate: { lte: filters.to } } : {}),
    },
    userId,
  };
  const [data, total] = await Promise.all([
    prisma.agentAssignment.findMany({
    include: {
      candidate: {
        select: {
          account: { select: { email: true, phone: true } },
          ballotNumber: true,
          id: true,
          manifesto: true,
          name: true,
          nickname: true,
          portfolio: { select: { id: true, name: true } },
          profilePicture: true,
          status: true,
        },
      },
      election: {
        select: {
          _count: { select: { candidates: true, portfolios: true, voterElections: true } },
          eligibilityGroups: {
            select: {
              group: {
                select: { category: { select: { name: true } }, id: true, name: true },
              },
            },
          },
          eligibilityMode: true,
          endDate: true,
          id: true,
          name: true,
          slug: true,
          startDate: true,
          status: true,
        },
      },
    },
    skip: pagination.skip,
    take: pagination.limit,
    where,
    }),
    prisma.agentAssignment.count({ where }),
  ]);
  return { data, meta: buildMeta(total, pagination.page, pagination.limit) };
};

/** A candidate's own candidacies. */
export const getCandidateDashboard = (userId: string) =>
  prisma.candidate.findMany({
    include: {
      election: { select: { id: true, name: true, slug: true, status: true } },
      portfolio: { select: { id: true, name: true } },
    },
    where: { account: { id: userId } },
  });

export const isStaff = (role: Role): boolean =>
  role === Role.SUPER_ADMIN || role === Role.ADMIN;
