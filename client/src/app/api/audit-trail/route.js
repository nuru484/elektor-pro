import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { requireSuperAdmin } from "@/utils/auth";

// GET /api/audit-trail - Retrieve audit trail for all voters and their votes (SUPER_ADMIN only)
export async function GET(req) {
  try {
    const user = await requireSuperAdmin();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    // Get electionId from query parameters
    const { searchParams } = new URL(req.url);
    const electionId = searchParams.get("electionId");

    // Build the query
    let whereClause = {};
    if (electionId && !isNaN(parseInt(electionId))) {
      whereClause = { electionId: parseInt(electionId) };
    }

    // Fetch all voters with their elections and vote actions
    const voters = await prisma.voter.findMany({
      include: {
        VoterElections: {
          where: whereClause,
          include: {
            election: {
              select: {
                id: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
        VoteActions: {
          where: whereClause,
          include: {
            election: {
              select: { id: true, name: true },
            },
            portfolio: {
              select: { id: true, name: true },
            },
            candidate: {
              select: { id: true, name: true, party: true, partySymbol: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Transform the data for the response
    const auditTrail = voters.map((voter) => ({
      voterId: voter.id,
      voterName: voter.name,
      voterUniqueId: voter.voterId,
      phoneNumber: voter.phoneNumber,
      elections: voter.VoterElections.map((ve) => ({
        electionId: ve.election.id,
        electionName: ve.election.name,
        status: ve.election.status,
        startDate: ve.election.startDate,
        endDate: ve.election.endDate,
        hasVoted: ve.hasVoted,
      })),
      votes: voter.VoteActions.map((vote) => ({
        electionId: vote.election.id,
        electionName: vote.election.name,
        portfolioId: vote.portfolio?.id || null,
        portfolioName: vote.portfolio?.name || null,
        candidateId: vote.candidate?.id || null,
        candidateName: vote.candidate?.name || null,
        candidateParty: vote.candidate?.party || null,
        candidatePartySymbol: vote.candidate?.partySymbol || null,
        actionType: vote.actionType,
        timestamp: vote.createdAt,
      })),
    }));

    // Calculate some statistics for charting
    const stats = {
      totalVoters: voters.length,
      totalVotes: voters.reduce(
        (sum, voter) => sum + voter.VoteActions.length,
        0
      ),
      votesByElection: {},
      votesByPortfolio: {},
    };

    // Aggregate votes by election
    voters.forEach((voter) => {
      voter.VoteActions.forEach((vote) => {
        const electionId = vote.election.id;
        stats.votesByElection[electionId] = stats.votesByElection[
          electionId
        ] || {
          name: vote.election.name,
          count: 0,
        };
        stats.votesByElection[electionId].count += 1;

        const portfolioId = vote.portfolio?.id || "no-portfolio";
        stats.votesByPortfolio[portfolioId] = stats.votesByPortfolio[
          portfolioId
        ] || {
          name: vote.portfolio?.name || "No Portfolio",
          count: 0,
        };
        stats.votesByPortfolio[portfolioId].count += 1;
      });
    });

    return NextResponse.json(
      {
        auditTrail,
        stats: {
          totalVoters: stats.totalVoters,
          totalVotes: stats.totalVotes,
          votesByElection: Object.values(stats.votesByElection),
          votesByPortfolio: Object.values(stats.votesByPortfolio),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error retrieving audit trail:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving audit trail." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
