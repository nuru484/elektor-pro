// src/app/api/results/[id]/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { verifySession, getUser } from "@/lib/dataAccessLayer";

export async function GET(req, { params }) {
  const electionId = params.id;

  console.log("Election ID: ", electionId);

  if (!electionId) {
    return NextResponse.json(
      { error: "Election ID is required" },
      { status: 400 }
    );
  }

  try {
    const electionIdInt = parseInt(electionId);

    if (isNaN(electionIdInt)) {
      return NextResponse.json(
        { error: "Invalid election ID" },
        { status: 400 }
      );
    }

    // Verify user session and role
    const session = await verifySession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated: Please log in." },
        { status: 401 }
      );
    }

    const currentUser = await getUser();
    const isAdmin =
      currentUser && ["SUPER_ADMIN", "ADMIN"].includes(currentUser.role);

    // Get election details
    const election = await prisma.election.findUnique({
      where: { id: electionIdInt },
      include: {
        Portfolio: {
          include: {
            Candidate: {
              include: {
                Votes: true,
                VoteActions: {
                  where: { actionType: "VOTE" },
                },
              },
            },
          },
        },
      },
    });

    if (!election) {
      return NextResponse.json(
        { error: "Election not found" },
        { status: 404 }
      );
    }

    // Restrict non-admins from viewing results of non-ended elections
    if (!isAdmin && election.status !== "ENDED") {
      return NextResponse.json(
        { error: "Results are only available after the election has ended." },
        { status: 403 }
      );
    }

    // Get total voters for this election
    const totalVoters = await prisma.voterElection.count({
      where: { electionId: electionIdInt },
    });

    // Get total votes cast
    const totalVotesCast = await prisma.voterElection.count({
      where: {
        electionId: electionIdInt,
        hasVoted: true,
      },
    });

    // Calculate results for each portfolio
    const portfolioResults = await Promise.all(
      election.Portfolio.map(async (portfolio) => {
        const totalPortfolioActions = await prisma.voteAction.count({
          where: {
            electionId: electionIdInt,
            portfolioId: portfolio.id,
          },
        });

        const skipVotes = await prisma.voteAction.count({
          where: {
            electionId: electionIdInt,
            portfolioId: portfolio.id,
            actionType: "SKIP",
          },
        });

        const candidateResults = await Promise.all(
          portfolio.Candidate.map(async (candidate) => {
            const voteCount = await prisma.voteAction.count({
              where: {
                electionId: electionIdInt,
                portfolioId: portfolio.id,
                candidateId: candidate.id,
                actionType: "VOTE",
              },
            });

            const percentage =
              totalPortfolioActions > 0
                ? ((voteCount / totalPortfolioActions) * 100).toFixed(2)
                : "0.00";

            return {
              id: candidate.id,
              name: candidate.name,
              party: candidate.party,
              partySymbol: candidate.partySymbol,
              profilePicture: candidate.profilePicture,
              voteCount,
              percentage: parseFloat(percentage),
            };
          })
        );

        candidateResults.sort((a, b) => b.voteCount - a.voteCount);

        const winner = candidateResults.length > 0 ? candidateResults[0] : null;

        const skipPercentage =
          totalPortfolioActions > 0
            ? ((skipVotes / totalPortfolioActions) * 100).toFixed(2)
            : "0.00";

        return {
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          portfolioDescription: portfolio.description,
          totalVotes: totalPortfolioActions,
          skipVotes,
          skipPercentage: parseFloat(skipPercentage),
          candidates: candidateResults,
          winner: winner?.voteCount > 0 ? winner : null,
        };
      })
    );

    const turnoutPercentage =
      totalVoters > 0
        ? ((totalVotesCast / totalVoters) * 100).toFixed(2)
        : "0.00";

    const results = {
      election: {
        id: election.id,
        name: election.name,
        description: election.description,
        status: election.status,
        startDate: election.startDate,
        endDate: election.endDate,
      },
      summary: {
        totalVoters,
        totalVotesCast,
        turnoutPercentage: parseFloat(turnoutPercentage),
        totalPortfolios: election.Portfolio.length,
      },
      portfolios: portfolioResults,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error("Error fetching election results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
