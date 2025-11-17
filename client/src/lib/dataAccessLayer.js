import "server-only";
import { cookies } from "next/headers";
import { decrypt } from "./session";
import prisma from "@/config/prismaClient";
import { redirect } from "next/navigation";

export async function verifySession() {
  try {
    const cookie = (await cookies()).get("session")?.value;
    if (!cookie) {
      redirect("/login");
    }

    const session = await decrypt(cookie);
    if (!session?.userId || !session?.role) {
      redirect("/login");
    }

    return { isAuth: true, userId: session.userId, role: session.role };
  } catch (error) {
    console.error("Error verifying session:", error);
    redirect("/login");
  }
}

export async function getUser() {
  try {
    const session = await verifySession();
    if (!session) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: session.userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        position: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      console.error("User not found for ID:", session.userId);
      return null;
    }

    return user;
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return null;
  }
}
