// src/app/api/admins/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { verifySession, getUser } from "@/lib/dataAccessLayer";
import bcrypt from "bcryptjs";

export async function GET(req) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated: Please log in." },
        { status: 401 }
      );
    }

    const currentUser = await getUser();
    if (!["SUPER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required." },
        { status: 403 }
      );
    }

    const admins = await prisma.user.findMany({
      where: {
        role: { in: ["SUPER_ADMIN", "ADMIN"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ admins }, { status: 200 });
  } catch (error) {
    console.error("Error fetching admins:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req) {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthenticated: Please log in." },
        { status: 401 }
      );
    }

    const currentUser = await getUser();
    if (!["SUPER_ADMIN", "ADMIN"].includes(currentUser.role)) {
      return NextResponse.json(
        { error: "Unauthorized: Admin access required." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");
    const role = formData.get("role");

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "All fields (name, email, password, role) are required." },
        { status: 400 }
      );
    }

    if (!["SUPER_ADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be SUPER_ADMIN or ADMIN." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists." },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    console.error("Error creating admin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
