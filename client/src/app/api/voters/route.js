import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { requireSuperAdmin } from "@/utils/auth";

// POST /api/voters - Create a new voter and associate with multiple elections (SUPER_ADMIN only)
export async function POST(req) {
  try {
    const isSuperAdmin = await requireSuperAdmin();
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, voterId, phoneNumber, profilePicture, electionIds } = body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (
      !electionIds ||
      !Array.isArray(electionIds) ||
      electionIds.length === 0
    ) {
      return NextResponse.json(
        { error: "At least one valid election ID is required." },
        { status: 400 }
      );
    }

    // Validate that all electionIds are valid numbers
    const parsedElectionIds = electionIds
      .map((id) => parseInt(id))
      .filter((id) => !isNaN(id));
    if (parsedElectionIds.length !== electionIds.length) {
      return NextResponse.json(
        { error: "All election IDs must be valid numbers." },
        { status: 400 }
      );
    }

    // Check if all elections exist
    const elections = await prisma.election.findMany({
      where: { id: { in: parsedElectionIds } },
    });
    if (elections.length !== parsedElectionIds.length) {
      const missingIds = parsedElectionIds.filter(
        (id) => !elections.some((election) => election.id === id)
      );
      return NextResponse.json(
        { error: `Elections with IDs ${missingIds.join(", ")} do not exist.` },
        { status: 404 }
      );
    }

    // Check if voter already exists by voterId or phoneNumber
    let voter;
    if (voterId || phoneNumber) {
      voter = await prisma.voter.findFirst({
        where: {
          OR: [
            voterId ? { voterId: voterId.trim() } : undefined,
            phoneNumber ? { phoneNumber: phoneNumber.trim() } : undefined,
          ].filter(Boolean),
        },
      });
    }

    // Check if voter is already associated with any of the provided elections
    if (voter) {
      const existingVoterElections = await prisma.voterElection.findMany({
        where: {
          voterId: voter.id,
          electionId: { in: parsedElectionIds },
        },
      });

      if (existingVoterElections.length > 0) {
        const alreadyAssociatedIds = existingVoterElections.map(
          (ve) => ve.electionId
        );
        return NextResponse.json(
          {
            error: `Voter with ID ${
              voter.id
            } is already associated with election IDs ${alreadyAssociatedIds.join(
              ", "
            )}.`,
          },
          { status: 409 }
        );
      }
    }

    // Create new voter or use existing voter
    if (!voter) {
      voter = await prisma.voter.create({
        data: {
          name: name.trim(),
          voterId: voterId ? voterId.trim() : null,
          phoneNumber: phoneNumber ? phoneNumber.trim() : null,
          profilePicture: profilePicture ? profilePicture.trim() : null,
        },
      });
    }

    // Associate voter with all provided elections
    const voterElectionData = parsedElectionIds.map((electionId) => ({
      voterId: voter.id,
      electionId,
      hasVoted: false,
    }));

    await prisma.voterElection.createMany({
      data: voterElectionData,
    });

    return NextResponse.json(
      {
        message: `Voter ${
          voter.id
        } successfully associated with election IDs ${parsedElectionIds.join(
          ", "
        )}.`,
        voter,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating voter:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: `A voter with this ${error.meta.target} already exists.`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while processing the voter." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/voters - Retrieve all voters grouped by election (authenticated access)
export async function GET(req) {
  const user = await requireSuperAdmin();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized: SUPER_ADMIN access required." },
      { status: 403 }
    );
  }
  try {
    // Fetch all elections with their associated voters through VoterElection
    const electionsWithVoters = await prisma.election.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        VoterElections: {
          include: {
            voter: {
              select: {
                id: true,
                name: true,
                voterId: true,
                phoneNumber: true,
                profilePicture: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Transform the data to group voters by election
    const votersByElection = electionsWithVoters.map((election) => ({
      electionId: election.id,
      electionName: election.name,
      voters: election.VoterElections.map((ve) => ({
        ...ve.voter,
        hasVoted: ve.hasVoted,
      })),
    }));

    return NextResponse.json(votersByElection, { status: 200 });
  } catch (error) {
    console.error("Error retrieving voters:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving voters." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
