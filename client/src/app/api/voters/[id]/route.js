import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { verifySession, getUser } from "@/lib/dataAccessLayer";
import { requireSuperAdmin } from "@/utils/auth";

// GET /api/voters/[id] - Retrieve a single voter (authenticated access)
export async function GET(req, { params }) {
  // First, verify the session
  const session = await verifySession();
  if (!session) {
    return NextResponse.json(
      { error: "Unauthenticated: Please log in." },
      { status: 401 }
    );
  }

  try {
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid voter ID." }, { status: 400 });
    }

    // Fetch the voter record with associated elections
    const voter = await prisma.voter.findUnique({
      where: { id },
      include: {
        VoterElections: {
          include: {
            election: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!voter) {
      return NextResponse.json(
        { error: `Voter with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    // Transform the data to include election details and hasVoted status
    const voterData = {
      id: voter.id,
      name: voter.name,
      voterId: voter.voterId,
      phoneNumber: voter.phoneNumber,
      profilePicture: voter.profilePicture,
      createdAt: voter.createdAt,
      updatedAt: voter.updatedAt,
      elections: voter.VoterElections.map((ve) => ({
        id: ve.election.id,
        name: ve.election.name,
        hasVoted: ve.hasVoted,
      })),
    };

    // Get the current user to check their role
    const currentUser = await getUser();

    // If user exists, check if they're admin
    if (currentUser) {
      const isAdmin =
        currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
      if (isAdmin) {
        // Admin can access any voter record
        return NextResponse.json(voterData, { status: 200 });
      }
    }

    // If not admin or getUser returned null, check if they're accessing their own record
    const isOwner =
      session.userId === voter.voterId ||
      session.userId === voter.id.toString();

    if (!isOwner) {
      return NextResponse.json(
        { error: "Forbidden: You can only access your own voter record." },
        { status: 403 }
      );
    }

    return NextResponse.json(voterData, { status: 200 });
  } catch (error) {
    console.error("Error retrieving voter:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving voter." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/voters/[id] - Update a voter (SUPER_ADMIN only)
export async function PUT(req, { params }) {
  try {
    const user = await requireSuperAdmin();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid voter ID." }, { status: 400 });
    }

    // Check if voter exists
    const voter = await prisma.voter.findUnique({
      where: { id },
    });
    if (!voter) {
      return NextResponse.json(
        { error: `Voter with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, voterId, phoneNumber, profilePicture, electionIds } = body;

    // Validate inputs
    if (name && name.trim() === "") {
      return NextResponse.json(
        { error: "Name cannot be empty." },
        { status: 400 }
      );
    }
    if (electionIds && !Array.isArray(electionIds)) {
      return NextResponse.json(
        { error: "electionIds must be an array of valid election IDs." },
        { status: 400 }
      );
    }

    // Validate election IDs if provided
    if (electionIds && electionIds.length > 0) {
      const elections = await prisma.election.findMany({
        where: { id: { in: electionIds.map((id) => parseInt(id)) } },
      });
      if (elections.length !== electionIds.length) {
        return NextResponse.json(
          { error: "One or more election IDs do not exist." },
          { status: 404 }
        );
      }
    }

    // Update voter and their election associations
    const updatedVoter = await prisma.voter.update({
      where: { id },
      data: {
        name: name ? name.trim() : voter.name,
        voterId:
          voterId !== undefined ? voterId?.trim() || null : voter.voterId,
        phoneNumber:
          phoneNumber !== undefined
            ? phoneNumber?.trim() || null
            : voter.phoneNumber,
        profilePicture:
          profilePicture !== undefined
            ? profilePicture?.trim() || null
            : voter.profilePicture,
        ...(electionIds && {
          VoterElections: {
            // Delete existing associations
            deleteMany: {},
            // Create new associations
            create: electionIds.map((electionId) => ({
              electionId: parseInt(electionId),
              hasVoted: false,
            })),
          },
        }),
      },
      include: {
        VoterElections: {
          include: {
            election: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Transform the response to match the GET route format
    const voterData = {
      id: updatedVoter.id,
      name: updatedVoter.name,
      voterId: updatedVoter.voterId,
      phoneNumber: updatedVoter.phoneNumber,
      profilePicture: updatedVoter.profilePicture,
      createdAt: updatedVoter.createdAt,
      updatedAt: updatedVoter.updatedAt,
      elections: updatedVoter.VoterElections.map((ve) => ({
        id: ve.election.id,
        name: ve.election.name,
        hasVoted: ve.hasVoted,
      })),
    };

    return NextResponse.json(
      { message: "Voter updated successfully.", voter: voterData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating voter:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: `A voter with this ${error.meta.target} already exists.`,
        },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: `Voter with ID ${params.id} does not exist.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while updating the voter." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/voters/[id] - Delete a voter (SUPER_ADMIN only)
export async function DELETE(req, { params }) {
  try {
    const user = await requireSuperAdmin();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid voter ID." }, { status: 400 });
    }

    // Check if voter exists
    const voter = await prisma.voter.findUnique({
      where: { id },
    });
    if (!voter) {
      return NextResponse.json(
        { error: `Voter with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    // Delete voter (cascades to related VoterElection records if configured in Prisma)
    await prisma.voter.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: `Voter with ID ${id} deleted successfully.` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting voter:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: `Voter with ID ${params.id} does not exist.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while deleting the voter." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
