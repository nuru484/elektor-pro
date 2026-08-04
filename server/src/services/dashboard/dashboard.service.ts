import {
  ChangeStatus,
  ElectionStatus,
  Role,
} from '../../../generated/prisma/client.js';
// src/services/dashboard/dashboard.service.ts
import prisma from '../../lib/prisma.js';

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

/** Elections + assignments visible to an agent. */
export const getAgentDashboard = (userId: string) =>
  prisma.agentAssignment.findMany({
    include: {
      candidate: { select: { id: true, name: true } },
      election: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
    where: { userId },
  });

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
