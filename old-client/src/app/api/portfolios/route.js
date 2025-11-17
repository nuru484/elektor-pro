import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { requireSuperAdmin } from "@/utils/auth";
import { getUser, verifySession } from "@/lib/dataAccessLayer";

// POST /api/portfolios - Create a new portfolio (SUPER_ADMIN only)
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
    const { name, description, electionId } = body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!electionId || isNaN(parseInt(electionId))) {
      return NextResponse.json(
        { error: "Valid election ID is required." },
        { status: 400 }
      );
    }

    // Check if election exists
    const election = await prisma.election.findUnique({
      where: { id: parseInt(electionId) },
    });
    if (!election) {
      return NextResponse.json(
        { error: `Election with ID ${electionId} does not exist.` },
        { status: 404 }
      );
    }

    // Create portfolio
    const portfolio = await prisma.portfolio.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        electionId: parseInt(electionId),
      },
    });

    return NextResponse.json(
      {
        message: `Portfolio ${portfolio.id} created successfully for election ID ${electionId}.`,
        portfolio,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating portfolio:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: `A portfolio with this ${error.meta.target} already exists.`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while creating the portfolio." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/portfolios - Retrieve portfolios based on user role and optional electionId
export async function GET(req) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated: Please log in." },
        { status: 401 }
      );
    }

    // Get electionId from query parameters
    const { searchParams } = new URL(req.url);
    const electionId = searchParams.get("electionId");

    // Get the current user to check their role
    const currentUser = await getUser();

    if (electionId && !isNaN(parseInt(electionId))) {
      // If electionId is provided, fetch portfolios for that specific election
      const election = await prisma.election.findUnique({
        where: { id: parseInt(electionId) },
        include: {
          Portfolio: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!election) {
        return NextResponse.json(
          { error: `Election with ID ${electionId} does not exist.` },
          { status: 404 }
        );
      }

      // Return portfolios as a flat array
      const portfolios = election.Portfolio.map((portfolio, index) => ({
        number: index + 1,
        id: portfolio.id,
        name: portfolio.name,
        description: portfolio.description,
        electionId: election.id,
        electionName: election.name,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt,
      }));

      return NextResponse.json({ portfolios }, { status: 200 });
    }

    // If no electionId, return portfolios grouped by election based on user role
    if (
      currentUser &&
      (currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN")
    ) {
      // Admins see all portfolios grouped by election
      const elections = await prisma.election.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          Portfolio: {
            select: {
              id: true,
              name: true,
              description: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      const result = elections.map((election) => ({
        electionId: election.id,
        electionName: election.name,
        description: election.description,
        status: election.status,
        startDate: election.startDate,
        endDate: election.endDate,
        portfolios: election.Portfolio.map((portfolio, index) => ({
          number: index + 1,
          id: portfolio.id,
          name: portfolio.name,
          description: portfolio.description,
          electionId: election.id,
          electionName: election.name,
          createdAt: portfolio.createdAt,
          updatedAt: portfolio.updatedAt,
        })),
      }));

      return NextResponse.json(result, { status: 200 });
    }

    // Non-admin users see only portfolios for their registered elections
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
            election: {
              include: {
                Portfolio: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                  orderBy: { createdAt: "asc" },
                },
              },
            },
          },
        },
      },
    });

    if (!voter || !voter.VoterElections || voter.VoterElections.length === 0) {
      return NextResponse.json(
        { error: "No portfolios found for your registered elections." },
        { status: 404 }
      );
    }

    // Map voter elections to portfolios
    const result = voter.VoterElections.map((ve) => {
      const election = ve.election;
      return {
        electionId: election.id,
        electionName: election.name,
        description: election.description,
        status: election.status,
        startDate: election.startDate,
        endDate: election.endDate,
        portfolios: election.Portfolio.map((portfolio, index) => ({
          number: index + 1,
          id: portfolio.id,
          name: portfolio.name,
          description: portfolio.description,
          electionId: election.id,
          electionName: election.name,
          createdAt: portfolio.createdAt,
          updatedAt: portfolio.updatedAt,
        })),
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error retrieving portfolios:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving portfolios." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
