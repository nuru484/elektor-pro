import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { verifySession, getUser } from "@/lib/dataAccessLayer";

export async function POST(request) {
  try {
    // Verify session and get user ID
    const session = await verifySession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated: Please log in." },
        { status: 401 }
      );
    }

    // Get voterId from session and check user role
    const voterId = session.userId;
    const currentUser = await getUser();

    // Check if user is an admin
    if (
      currentUser &&
      (currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN")
    ) {
      // Admins must be registered as voters to vote
      const adminVoter = await prisma.voter.findUnique({
        where: { voterId: String(voterId) },
        select: { id: true, name: true, voterId: true },
      });

      if (!adminVoter) {
        return NextResponse.json(
          {
            error:
              "Admin is not registered as a voter. Register as a voter to vote.",
          },
          { status: 403 }
        );
      }
    }

    const { electionId, votes } = await request.json();

    // Validate input
    if (!electionId || !votes || !Array.isArray(votes)) {
      return NextResponse.json(
        { error: "Missing required fields or invalid vote format" },
        { status: 400 }
      );
    }

    // Check if election exists and is in progress
    const election = await prisma.election.findUnique({
      where: { id: electionId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        startDate: true,
        endDate: true,
        Portfolio: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!election) {
      console.warn("Election not found for ID:", electionId);
      return NextResponse.json(
        { error: "Election not found" },
        { status: 404 }
      );
    }

    if (election.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: `Election is not active ${election.status}` },
        { status: 400 }
      );
    }

    // Check if current time is within election period
    const now = new Date();

    if (
      now < new Date(election.startDate) ||
      now > new Date(election.endDate)
    ) {
      return NextResponse.json(
        { error: "Election is not currently active" },
        { status: 400 }
      );
    }

    // Check if voter exists using only voterId (string)
    const voter = await prisma.voter.findUnique({
      where: { voterId: String(voterId) },
      select: { id: true, name: true, voterId: true },
    });

    if (!voter) {
      return NextResponse.json({ error: "Voter not found" }, { status: 404 });
    }

    // Check if voter has already voted in this election
    const existingVoterElection = await prisma.voterElection.findUnique({
      where: {
        voterId_electionId: {
          voterId: voter.id,
          electionId: electionId,
        },
      },
    });

    if (existingVoterElection && existingVoterElection.hasVoted) {
      return NextResponse.json(
        { error: "Voter has already voted in this election" },
        { status: 400 }
      );
    }

    // Validate votes format and candidates
    const portfolioIds = election.Portfolio.map((p) => p.id);
    const validatedVotes = [];

    for (const vote of votes) {
      const { portfolioId, candidateId, actionType = "VOTE" } = vote;

      if (!portfolioId || (!candidateId && actionType === "VOTE")) {
        return NextResponse.json(
          { error: "Invalid vote format" },
          { status: 400 }
        );
      }

      if (!portfolioIds.includes(portfolioId)) {
        return NextResponse.json(
          { error: `Portfolio ${portfolioId} not found in this election` },
          { status: 400 }
        );
      }

      // If voting for a candidate, validate candidate exists and belongs to the portfolio
      if (actionType === "VOTE" && candidateId) {
        const candidate = await prisma.candidate.findUnique({
          where: { id: candidateId },
          select: { id: true, portfolioId: true, electionId: true },
        });

        if (!candidate) {
          return NextResponse.json(
            { error: `Candidate ${candidateId} not found` },
            { status: 400 }
          );
        }

        if (
          candidate.portfolioId !== portfolioId ||
          candidate.electionId !== electionId
        ) {
          return NextResponse.json(
            {
              error: `Candidate ${candidateId} does not belong to portfolio ${portfolioId} in this election`,
            },
            { status: 400 }
          );
        }
      }

      validatedVotes.push({
        portfolioId,
        candidateId: actionType === "VOTE" ? candidateId : null,
        actionType,
      });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create or update voter election record
      const voterElection = await tx.voterElection.upsert({
        where: {
          voterId_electionId: {
            voterId: voter.id,
            electionId: electionId,
          },
        },
        update: {
          hasVoted: true,
        },
        create: {
          voterId: voter.id,
          electionId: electionId,
          hasVoted: true,
        },
      });

      const voteActions = await Promise.all(
        validatedVotes.map(async (vote) => {
          const voteAction = await tx.voteAction.create({
            data: {
              voterId: voter.id,
              electionId: electionId,
              portfolioId: vote.portfolioId,
              candidateId: vote.candidateId,
              actionType: vote.actionType,
            },
          });
          return voteAction;
        })
      );

      // Create actual votes for non-skipped portfolios
      const actualVotes = await Promise.all(
        validatedVotes
          .filter((vote) => vote.actionType === "VOTE")
          .map(async (vote) => {
            const voteRecord = await tx.votes.create({
              data: {
                voterId: voter.id,
                candidateId: vote.candidateId,
                electionId: electionId,
              },
            });
            return voteRecord;
          })
      );

      return { voterElection, voteActions, actualVotes };
    });

    // Calculate updated results for real-time emission (aligned with results API)
    const portfolioResults = await Promise.all(
      election.Portfolio.map(async (portfolio) => {
        // Get total votes for this portfolio (including skips)
        const totalPortfolioActions = await prisma.voteAction.count({
          where: {
            electionId: electionId,
            portfolioId: portfolio.id,
          },
        });

        // Get skip votes for this portfolio
        const skipVotes = await prisma.voteAction.count({
          where: {
            electionId: electionId,
            portfolioId: portfolio.id,
            actionType: "SKIP",
          },
        });

        // Get all candidates for this portfolio
        const candidates = await prisma.candidate.findMany({
          where: {
            portfolioId: portfolio.id,
            electionId: electionId,
          },
          select: {
            id: true,
            name: true,
            profilePicture: true,
            party: true,
            partySymbol: true,
          },
        });

        // Calculate candidate results
        const candidateResults = await Promise.all(
          candidates.map(async (candidate) => {
            const voteCount = await prisma.voteAction.count({
              where: {
                electionId: electionId,
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

        // Sort candidates by vote count (descending)
        candidateResults.sort((a, b) => b.voteCount - a.voteCount);

        // Determine winner
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

    // Get total voters and votes cast for summary
    const totalVoters = await prisma.voterElection.count({
      where: { electionId: electionId },
    });

    const totalVotesCast = await prisma.voterElection.count({
      where: {
        electionId: electionId,
        hasVoted: true,
      },
    });

    const turnoutPercentage =
      totalVoters > 0
        ? ((totalVotesCast / totalVoters) * 100).toFixed(2)
        : "0.00";

    // Emit real-time update to all clients in the election room
    if (global.io) {
      global.io.to(`election:${electionId}`).emit("voteUpdate", {
        electionId,
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
        timestamp: new Date().toISOString(),
      });

      global.io.to(`results:${electionId}`).emit("resultsUpdate", {
        electionId,
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
        timestamp: new Date().toISOString(),
      });
    } else {
      console.warn("Socket.io global.io is not initialized");
    }

    return NextResponse.json(
      {
        message: "Votes recorded successfully",
        voterId: voter.voterId,
        electionId: electionId,
        totalVotes: result.actualVotes.length,
        portfolioResults,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error processing votes:", error);
    return NextResponse.json(
      { error: `Internal server error ${error}` },
      { status: 500 }
    );
  } finally {
    console.log("Disconnecting Prisma client");
    await prisma.$disconnect();
  }
}
