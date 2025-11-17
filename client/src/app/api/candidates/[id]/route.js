// src/app/api/candidates/[id]/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { requireSuperAdmin } from "@/utils/auth";
import {
  uploadFileToCloudinary,
  deleteFileFromCloudinary,
} from "@/config/cloudinary";
import { verifySession } from "@/lib/dataAccessLayer";
import { getUser } from "@/lib/dataAccessLayer";

// GET /api/candidates/[id] - Retrieve a single candidate (authenticated access)
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
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        election: {
          select: { id: true, name: true },
        },
        portfolio: {
          select: { id: true, name: true },
        },
      },
    });

    if (!candidate) {
      return NextResponse.json(
        { error: `Candidate with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    const candidateData = {
      id: candidate.id,
      name: candidate.name,
      profilePicture: candidate.profilePicture,
      party: candidate.party,
      partySymbol: candidate.partySymbol,
      electionId: candidate.election.id,
      electionName: candidate.election.name,
      portfolioId: candidate.portfolio.id,
      portfolioName: candidate.portfolio.name,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    };

    const currentUser = await getUser();
    if (currentUser) {
      const isAdmin =
        currentUser.role === "SUPER_ADMIN" || currentUser.role === "ADMIN";
      if (isAdmin) {
        return NextResponse.json(candidateData, { status: 200 });
      }
    }

    return NextResponse.json(
      { error: "Forbidden: Admin access required to view candidate details." },
      { status: 403 }
    );
  } catch (error) {
    console.error("Error retrieving candidate:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred while retrieving candidate." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT /api/candidates/[id] - Update a candidate (SUPER_ADMIN only)
export async function PUT(req, { params }) {
  try {
    const user = await requireSuperAdmin();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    // Await params to resolve the dynamic route parameter
    const id = parseInt(await params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    // Check if candidate exists
    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });
    if (!candidate) {
      return NextResponse.json(
        { error: `Candidate with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const name = formData.get("name")?.toString().trim();
    const party = formData.get("party")?.toString().trim();
    const partySymbol = formData.get("partySymbol")?.toString().trim();
    const electionId = formData.get("electionId")
      ? parseInt(formData.get("electionId"))
      : undefined;
    const portfolioId = formData.get("portfolioId")
      ? parseInt(formData.get("portfolioId"))
      : undefined;
    const file = formData.get("profilePicture");

    // Validate inputs (allow unchanged or empty optional fields)
    if (name === "") {
      return NextResponse.json(
        { error: "Name cannot be empty." },
        { status: 400 }
      );
    }
    if (electionId && isNaN(electionId)) {
      return NextResponse.json(
        { error: "Valid election ID is required." },
        { status: 400 }
      );
    }
    if (portfolioId && isNaN(portfolioId)) {
      return NextResponse.json(
        { error: "Valid portfolio ID is required." },
        { status: 400 }
      );
    }

    // Validate election and portfolio if provided
    if (electionId) {
      const election = await prisma.election.findUnique({
        where: { id: electionId },
      });
      if (!election) {
        return NextResponse.json(
          { error: `Election with ID ${electionId} does not exist.` },
          { status: 404 }
        );
      }
    }
    if (portfolioId) {
      const portfolio = await prisma.portfolio.findUnique({
        where: { id: portfolioId },
      });
      if (!portfolio || (electionId && portfolio.electionId !== electionId)) {
        return NextResponse.json(
          {
            error: `Portfolio with ID ${portfolioId} does not exist or is not associated with election ID ${electionId}.`,
          },
          { status: 404 }
        );
      }
    }

    // Handle profile picture update
    let profilePictureUrl = candidate.profilePicture;
    if (file && file !== "null" && file.size > 0) {
      if (candidate.profilePicture) {
        await deleteFileFromCloudinary(candidate.profilePicture);
      }
      profilePictureUrl = await uploadFileToCloudinary(file);
    }

    // Update candidate with only provided fields
    const updatedCandidate = await prisma.candidate.update({
      where: { id },
      data: {
        name: name !== undefined ? name : candidate.name,
        party: party !== undefined ? party || null : candidate.party,
        partySymbol:
          partySymbol !== undefined
            ? partySymbol || null
            : candidate.partySymbol,
        electionId:
          electionId !== undefined ? electionId : candidate.electionId,
        portfolioId:
          portfolioId !== undefined ? portfolioId : candidate.portfolioId,
        profilePicture:
          profilePictureUrl !== undefined
            ? profilePictureUrl
            : candidate.profilePicture,
      },
      include: {
        election: { select: { id: true, name: true } },
        portfolio: { select: { id: true, name: true } },
      },
    });

    const candidateData = {
      id: updatedCandidate.id,
      name: updatedCandidate.name,
      profilePicture: updatedCandidate.profilePicture,
      party: updatedCandidate.party,
      partySymbol: updatedCandidate.partySymbol,
      electionId: updatedCandidate.election.id,
      electionName: updatedCandidate.election.name,
      portfolioId: updatedCandidate.portfolio.id,
      portfolioName: updatedCandidate.portfolio.name,
      createdAt: updatedCandidate.createdAt,
      updatedAt: updatedCandidate.updatedAt,
    };

    return NextResponse.json(
      { message: "Candidate updated successfully.", candidate: candidateData },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating candidate:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: `A candidate with this ${error.meta.target} already exists.` },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: `Candidate with ID ${params.id} does not exist.` },
        { status: 404 }
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

// DELETE /api/candidates/[id] - Delete a candidate (SUPER_ADMIN only)
export async function DELETE(req, { params }) {
  try {
   
    const user = await requireSuperAdmin();
    console.timeEnd("requireSuperAdmin");
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "Invalid candidate ID." },
        { status: 400 }
      );
    }

    console.time("findUnique candidate");
    const candidate = await prisma.candidate.findUnique({
      where: { id },
    });
    console.timeEnd("findUnique candidate");
    if (!candidate) {
      return NextResponse.json(
        { error: `Candidate with ID ${id} does not exist.` },
        { status: 404 }
      );
    }

    console.time("deleteFileFromCloudinary");
    if (candidate.profilePicture) {
      try {
        await deleteFileFromCloudinary(candidate.profilePicture);
      } catch (cloudinaryError) {
        console.warn("Failed to delete Cloudinary file:", cloudinaryError);
      }
    }
    console.timeEnd("deleteFileFromCloudinary");

    console.time("delete candidate");
    await prisma.candidate.delete({
      where: { id },
    });
    console.timeEnd("delete candidate");

    console.timeEnd("DELETE candidate total");
    return NextResponse.json(
      { message: `Candidate with ID ${id} deleted successfully.` },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting candidate:", error);
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: `Candidate with ID ${params.id} does not exist.` },
        { status: 404 }
      );
    }
    if (error.name === "TimeoutError") {
      return NextResponse.json(
        {
          error:
            "Request timed out while deleting the candidate. Please try again.",
        },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred while deleting the candidate." },
      { status: 500 }
    );
  } finally {
    console.time("prisma disconnect");
    await prisma.$disconnect();
    console.timeEnd("prisma disconnect");
  }
}
