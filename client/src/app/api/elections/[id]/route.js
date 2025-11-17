// src/app/api/elections/[id]/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { requireSuperAdmin } from "@/utils/auth";
import { verifySession } from "@/lib/dataAccessLayer";

// GET /api/elections/[id] - Retrieve a single election (authenticated access)
export async function GET(req, { params }) {
  // Fixed: added params parameter
  const session = await verifySession();
  if (!session)
    return NextResponse.json(
      { error: "Unauthenticated: Please log in." },
      { status: 401 }
    );

  try {
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid election ID." },
        { status: 400 }
      );
    }

    const election = await prisma.election.findUnique({
      where: { id },
    });

    if (!election) {
      return NextResponse.json(
        { error: `Election with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    return NextResponse.json(election, { status: 200 });
  } catch (error) {
    console.error("Error retrieving election:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving election." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/elections/[id] - Update an election (SUPER_ADMIN only)
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
      return NextResponse.json(
        { error: "Invalid election ID." },
        { status: 400 }
      );
    }

    // Check if election exists
    const election = await prisma.election.findUnique({
      where: { id },
    });
    if (!election) {
      return NextResponse.json(
        { error: `Election with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, description, startDate, endDate, status } = body;

    // Validate inputs
    if (name && name.trim() === "") {
      return NextResponse.json(
        { error: "Name cannot be empty." },
        { status: 400 }
      );
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

    // Update election
    const updatedElection = await prisma.election.update({
      where: { id },
      data: {
        name: name ? name.trim() : election.name,
        description:
          description !== undefined
            ? description?.trim() || null
            : election.description,
        startDate: start || election.startDate,
        endDate: end || election.endDate,
        status: status || election.status,
      },
    });

    return NextResponse.json(
      { message: "Election updated successfully.", election: updatedElection },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating election:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "An election with this name already exists." },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: `Election with ID ${params.id} does not exist.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while updating the election." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/elections/[id] - Delete an election (SUPER_ADMIN only)
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
      return NextResponse.json(
        { error: "Invalid election ID." },
        { status: 400 }
      );
    }

    // Check if election exists
    const election = await prisma.election.findUnique({
      where: { id },
    });
    if (!election) {
      return NextResponse.json(
        { error: `Election with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    // Delete election (cascades to related records if configured in Prisma)
    await prisma.election.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: `Election with ID ${id} deleted successfully.` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting election:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: `Election with ID ${params.id} does not exist.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while deleting the election." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
