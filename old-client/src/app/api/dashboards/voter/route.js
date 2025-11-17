// src/app/api/dashboards/voter/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { verifySession } from "@/lib/dataAccessLayer";

export async function GET(req) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated: Please log in." },
        { status: 401 }
      );
    }

    const voter = await prisma.voter.findUnique({
      where: { voterId: String(session.userId) },
      include: {
        VoterElections: {
          include: {
            election: {
              include: {
                Portfolio: {
                  include: {
                    Candidate: {
                      select: {
                        id: true,
                        name: true,
                        profilePicture: true,
                        party: true,
                        partySymbol: true,
                        Votes: true,
                        VoteActions: {
                          where: { actionType: "VOTE" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!voter || !voter.VoterElections.length) {
      return NextResponse.json(
        { error: "No elections found for this voter." },
        { status: 404 }
      );
    }

    const dashboardData = await Promise.all(
      voter.VoterElections.map(async (ve) => {
        const election = ve.election;
        const totalVoters = await prisma.voterElection.count({
          where: { electionId: election.id },
        });

        const totalVotesCast = await prisma.voterElection.count({
          where: {
            electionId: election.id,
            hasVoted: true,
          },
        });

        const portfolioResults =
          election.status === "ENDED"
            ? await Promise.all(
                election.Portfolio.map(async (portfolio) => {
                  const totalPortfolioActions = await prisma.voteAction.count({
                    where: {
                      electionId: election.id,
                      portfolioId: portfolio.id,
                    },
                  });

                  const skipVotes = await prisma.voteAction.count({
                    where: {
                      electionId: election.id,
                      portfolioId: portfolio.id,
                      actionType: "SKIP",
                    },
                  });

                  const candidateResults = await Promise.all(
                    portfolio.Candidate.map(async (candidate) => {
                      const voteCount = await prisma.voteAction.count({
                        where: {
                          electionId: election.id,
                          portfolioId: portfolio.id,
                          candidateId: candidate.id,
                          actionType: "VOTE",
                        },
                      });

                      const percentage =
                        totalPortfolioActions > 0
                          ? ((voteCount / totalPortfolioActions) * 100).toFixed(
                              2
                            )
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

                  const winner =
                    candidateResults.length > 0 ? candidateResults[0] : null;

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
              )
            : [];

        const turnoutPercentage =
          totalVoters > 0
            ? ((totalVotesCast / totalVoters) * 100).toFixed(2)
            : "0.00";

        return {
          electionId: election.id,
          electionName: election.name,
          description: election.description,
          status: election.status,
          startDate: election.startDate,
          endDate: election.endDate,
          hasVoted: ve.hasVoted,
          summary: {
            totalVoters,
            totalVotesCast,
            turnoutPercentage: parseFloat(turnoutPercentage),
            totalPortfolios: election.Portfolio.length,
            totalCandidates: election.Portfolio.reduce(
              (sum, p) => sum + p.Candidate.length,
              0
            ),
          },
          portfolios: portfolioResults,
        };
      })
    );

    return NextResponse.json(
      {
        voter: {
          id: voter.id,
          name: voter.name,
          voterId: voter.voterId,
        },
        elections: dashboardData,
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching voter dashboard data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
