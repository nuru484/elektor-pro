import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { verifySession, getUser } from "@/lib/dataAccessLayer";

export async function GET(request) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated: Please log in." },
        { status: 401 }
      );
    }

    const currentUser = await getUser();
    if (!currentUser || !["SUPER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const electionId = parseInt(searchParams.get("electionId"));
    if (!electionId || isNaN(electionId)) {
      return NextResponse.json(
        { error: "Valid election ID is required." },
        { status: 400 }
      );
    }

    const auditLogs = await prisma.voteAction.findMany({
      where: { electionId },
      include: {
        voter: { select: { name: true } },
        portfolio: { select: { name: true } },
        candidate: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(auditLogs, { status: 200 });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
