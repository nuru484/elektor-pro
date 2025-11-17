// src/app/api/elections/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { verifySession, getUser } from "@/lib/dataAccessLayer";
import { requireSuperAdmin } from "@/utils/auth";

// POST /api/elections - Create a new election (SUPER_ADMIN only)
export async function POST(req) {
  try {
    const user = await requireSuperAdmin();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, description, startDate, endDate, status } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    // Validate dates
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (startDate && isNaN(start.getTime())) {
      return NextResponse.json(
        {
          error:
            "Invalid startDate format. Use ISO 8601 format (e.g., 2025-07-11T00:00:00Z).",
        },
        { status: 400 }
      );
    }

    if (endDate && isNaN(end.getTime())) {
      return NextResponse.json(
        {
          error:
            "Invalid endDate format. Use ISO 8601 format (e.g., 2025-07-11T00:00:00Z).",
        },
        { status: 400 }
      );
    }

    if (start && end && start >= end) {
      return NextResponse.json(
        { error: "startDate must be before endDate." },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = [
      "UPCOMING",
      "IN_PROGRESS",
      "ENDED",
      "PAUSED",
      "CANCELLED",
    ];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // Create election
    const election = await prisma.election.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        startDate: start || new Date(),
        endDate: end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: status || "IN_PROGRESS",
      },
    });

    return NextResponse.json(
      { message: "Election created successfully.", election },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating election:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "An election with this name already exists." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while creating the election." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/elections - Retrieve elections based on user role
export async function GET(req) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated: Please log in." },
        { status: 401 }
      );
    }

    // Get the current user to check their role
    const currentUser = await getUser();

    // Check if the user is an admin or super admin
    if (
      currentUser &&
      (currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN")
    ) {
      const elections = await prisma.election.findMany({
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(elections, { status: 200 });
    }

    const voter = await prisma.voter.findFirst({
      where: {
        OR: [
          { voterId: String(session.userId) },
          { id: parseInt(session.userId, 10) || 0 },
        ],
      },
      include: {
        VoterElections: {
          include: {
            election: true,
          },
        },
      },
    });

    if (!voter || !voter.VoterElections || voter.VoterElections.length === 0) {
      return NextResponse.json(
        { error: "No elections found for this voter." },
        { status: 404 }
      );
    }

    // Extract elections from VoterElections
    const elections = voter.VoterElections.map((ve) => ({
      ...ve.election,
      hasVoted: ve.hasVoted,
    }));

    return NextResponse.json(elections, { status: 200 });
  } catch (error) {
    console.error("Error retrieving elections:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving elections." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
