// src/app/api/candidates/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { requireSuperAdmin } from "@/utils/auth";
import { uploadFileToCloudinary } from "@/config/cloudinary";
import { verifySession, getUser } from "@/lib/dataAccessLayer";

// POST /api/candidates - Create a new candidate and associate as a voter (SUPER_ADMIN only)
export async function POST(req) {
  try {
    const isSuperAdmin = await requireSuperAdmin();
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const name = formData.get("name")?.toString().trim();
    const party = formData.get("party")?.toString().trim();
    const partySymbol = formData.get("partySymbol")?.toString().trim();
    const electionId = parseInt(formData.get("electionId"));
    const portfolioId = parseInt(formData.get("portfolioId"));
    const file = formData.get("profilePicture");

    // Validate required fields
    if (!name || name === "") {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!electionId || isNaN(electionId)) {
      return NextResponse.json(
        { error: "Valid election ID is required." },
        { status: 400 }
      );
    }
    if (!portfolioId || isNaN(portfolioId)) {
      return NextResponse.json(
        { error: "Valid portfolio ID is selected." },
        { status: 400 }
      );
    }

    // Check if election exists
    const election = await prisma.election.findUnique({
      where: { id: electionId },
    });
    if (!election) {
      return NextResponse.json(
        { error: `Election with ID ${electionId} does not exist.` },
        { status: 404 }
      );
    }

    // Check if portfolio exists and belongs to the election
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    if (!portfolio || portfolio.electionId !== electionId) {
      return NextResponse.json(
        {
          error: `Portfolio with ID ${portfolioId} does not exist or is not associated with election ID ${electionId}.`,
        },
        { status: 404 }
      );
    }

    // Upload profile picture to Cloudinary if provided
    let profilePictureUrl = null;
    if (file && file !== "null" && file.size > 0) {
      profilePictureUrl = await uploadFileToCloudinary(file);
    }

    // Create voter record for the candidate
    const voter = await prisma.voter.create({
      data: {
        name,
        profilePicture: profilePictureUrl,
      },
    });

    // Associate voter with election
    await prisma.voterElection.create({
      data: {
        voterId: voter.id,
        electionId,
        hasVoted: false,
      },
    });

    // Create candidate
    const candidate = await prisma.candidate.create({
      data: {
        name,
        profilePicture: profilePictureUrl,
        party: party || null,
        partySymbol: partySymbol || null,
        electionId,
        portfolioId,
      },
    });

    return NextResponse.json(
      {
        message: `Candidate ${candidate.id} created and associated as voter ${voter.id} for election ID ${electionId}.`,
        candidate,
        voter,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating candidate:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error: `A candidate or voter with this ${error.meta.target} already exists.`,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: `An unexpected error occurred: ${error.message}` },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET /api/candidates - Retrieve candidates based on user role and optional electionId
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
      // If electionId is provided, fetch candidates for that specific election
      const election = await prisma.election.findUnique({
        where: { id: parseInt(electionId) },
        include: {
          Portfolio: {
            orderBy: { createdAt: "asc" },
            include: {
              Candidate: {
                select: {
                  id: true,
                  name: true,
                  profilePicture: true,
                  party: true,
                  partySymbol: true,
                  portfolioId: true,
                  createdAt: true,
                  updatedAt: true,
                },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      if (!election) {
        return NextResponse.json(
          { error: `Election with ID ${electionId} does not exist.` },
          { status: 404 }
        );
      }

      // Return portfolios with their candidates
      const portfolios = election.Portfolio.map((portfolio) => ({
        portfolioId: portfolio.id,
        portfolioName: portfolio.name,
        candidates: portfolio.Candidate.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          profilePicture: candidate.profilePicture,
          party: candidate.party,
          partySymbol: candidate.partySymbol,
          portfolioId: candidate.portfolioId,
          portfolioName: portfolio.name,
          createdAt: candidate.createdAt,
          updatedAt: candidate.updatedAt,
        })),
      }));

      return NextResponse.json({ portfolios }, { status: 200 });
    }

    // If no electionId, return candidates grouped by election and portfolio based on user role
    if (
      currentUser &&
      (currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN")
    ) {
      // Admins see all candidates grouped by election and portfolio
      const elections = await prisma.election.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          startDate: true,
          endDate: true,
          Portfolio: {
            orderBy: { createdAt: "asc" },
            include: {
              Candidate: {
                select: {
                  id: true,
                  name: true,
                  profilePicture: true,
                  party: true,
                  partySymbol: true,
                  portfolioId: true,
                  createdAt: true,
                  updatedAt: true,
                },
                orderBy: { createdAt: "asc" },
              },
            },
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
        portfolios: election.Portfolio.map((portfolio) => ({
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          candidates: portfolio.Candidate.map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            profilePicture: candidate.profilePicture,
            party: candidate.party,
            partySymbol: candidate.partySymbol,
            portfolioId: candidate.portfolioId,
            portfolioName: portfolio.name,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt,
          })),
        })),
      }));

      return NextResponse.json(result, { status: 200 });
    }

    // Non-admin users see only candidates for their registered elections
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
                  orderBy: { createdAt: "asc" },
                  include: {
                    Candidate: {
                      select: {
                        id: true,
                        name: true,
                        profilePicture: true,
                        party: true,
                        partySymbol: true,
                        portfolioId: true,
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
        },
      },
    });

    if (!voter || !voter.VoterElections || voter.VoterElections.length === 0) {
      return NextResponse.json(
        { error: "No candidates found for your registered elections." },
        { status: 404 }
      );
    }

    // Map voter elections to candidates
    const result = voter.VoterElections.map((ve) => {
      const election = ve.election;
      return {
        electionId: election.id,
        electionName: election.name,
        description: election.description,
        status: election.status,
        startDate: election.startDate,
        endDate: election.endDate,
        portfolios: election.Portfolio.map((portfolio) => ({
          portfolioId: portfolio.id,
          portfolioName: portfolio.name,
          candidates: portfolio.Candidate.map((candidate) => ({
            id: candidate.id,
            name: candidate.name,
            profilePicture: candidate.profilePicture,
            party: candidate.party,
            partySymbol: candidate.partySymbol,
            portfolioId: candidate.portfolioId,
            portfolioName: portfolio.name,
            createdAt: candidate.createdAt,
            updatedAt: candidate.updatedAt,
          })),
        })),
      };
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Error retrieving candidates:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving candidates." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
