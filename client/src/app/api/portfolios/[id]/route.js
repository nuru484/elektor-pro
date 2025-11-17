import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { requireSuperAdmin } from "@/utils/auth";
import { verifySession } from "@/lib/dataAccessLayer";
import { getUser } from "@/lib/dataAccessLayer";

// GET /api/portfolios/[id] - Retrieve a single portfolio (authenticated access)
export async function GET(req, { params }) {
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
      return NextResponse.json(
        { error: "Invalid portfolio ID." },
        { status: 400 }
      );
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      include: {
        election: {
          select: { id: true, name: true },
        },
      },
    });

    if (!portfolio) {
      return NextResponse.json(
        { error: `Portfolio with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    const portfolioData = {
      id: portfolio.id,
      name: portfolio.name,
      description: portfolio.description,
      electionId: portfolio.election.id,
      electionName: portfolio.election.name,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };

    const currentUser = await getUser();
    if (currentUser) {
      const isAdmin =
        currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
      if (isAdmin) {
        return NextResponse.json(portfolioData, { status: 200 });
      }
    }

    return NextResponse.json(
      { error: "Forbidden: Admin access required to view portfolio details." },
      { status: 403 }
    );
  } catch (error) {
    console.error("Error retrieving portfolio:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving portfolio." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/portfolios/[id] - Update a portfolio (SUPER_ADMIN only)
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
        { error: "Invalid portfolio ID." },
        { status: 400 }
      );
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
    });
    if (!portfolio) {
      return NextResponse.json(
        { error: `Portfolio with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { name, description, electionId } = body;

    // Validate inputs
    if (name && name.trim() === "") {
      return NextResponse.json(
        { error: "Name cannot be empty." },
        { status: 400 }
      );
    }
    if (electionId && isNaN(parseInt(electionId))) {
      return NextResponse.json(
        { error: "Valid election ID is required." },
        { status: 400 }
      );
    }

    // Validate election if provided
    if (electionId) {
      const election = await prisma.election.findUnique({
        where: { id: parseInt(electionId) },
      });
      if (!election) {
        return NextResponse.json(
          { error: `Election with ID ${electionId} does not exist.` },
          { status: 404 }
        );
      }
    }

    // Update portfolio
    const updatedPortfolio = await prisma.portfolio.update({
      where: { id },
      data: {
        name: name ? name.trim() : portfolio.name,
        description:
          description !== undefined
            ? description?.trim() || null
            : portfolio.description,
        electionId: electionId ? parseInt(electionId) : portfolio.electionId,
      },
      include: {
        election: { select: { id: true, name: true } },
      },
    });

    const portfolioData = {
      id: updatedPortfolio.id,
      name: updatedPortfolio.name,
      description: updatedPortfolio.description,
      electionId: updatedPortfolio.election.id,
      electionName: updatedPortfolio.election.name,
      createdAt: updatedPortfolio.createdAt,
      updatedAt: updatedPortfolio.updatedAt,
    };

    return NextResponse.json(
      { message: "Portfolio updated successfully.", portfolio: portfolioData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating portfolio:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: `A portfolio with this ${error.meta.target} already exists.`,
        },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: `Portfolio with ID ${params.id} does not exist.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while updating the portfolio." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// DELETE /api/portfolios/[id] - Delete a portfolio (SUPER_ADMIN only)
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
        { error: "Invalid portfolio ID." },
        { status: 400 }
      );
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
    });
    if (!portfolio) {
      return NextResponse.json(
        { error: `Portfolio with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    // Delete portfolio (cascades to related records if configured in Prisma)
    await prisma.portfolio.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: `Portfolio with ID ${id} deleted successfully.` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting portfolio:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: `Portfolio with ID ${params.id} does not exist.` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while deleting the portfolio." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
