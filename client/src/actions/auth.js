// src/actions/auth.js
"use server";
import { SignupFormSchema } from "@/validation/signup-validation";
import prisma from "@/config/prismaClient";
import bcrypt from "bcryptjs";
import { createSession, deleteSession } from "@/lib/session";
import { z } from "zod";
import { redirect } from "next/navigation";

export async function signup(state, formData) {
  // Validate form fields
  const validatedFields = SignupFormSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone"),
  });

  // If any form fields are invalid, return early
  if (!validatedFields.success) {
    return {
      success: false,
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { name, email, password, phone } = validatedFields.data;
  // Hash the user's password
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Check if a super admin already exists
    const superAdmin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
    });

    if (superAdmin) {
      return {
        success: false,
        errors: {
          general: ["Super admin already exists. Contact them to be added."],
        },
      };
    }

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        errors: { email: ["Email already in use"] },
      };
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone, // Add phone to the data
        role: "SUPER_ADMIN",
      },
    });

    // Create session
    await createSession(user.id, user.role);

    // Redirect to dashboard
    redirect("/dashboard");
  } catch (error) {
    // Only log errors that are not NEXT_REDIRECT
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error during signup:", error);

    // Handle specific Prisma errors
    if (error.code === "P2002") {
      return {
        success: false,
        errors: { email: ["Email already in use"] },
      };
    }

    return {
      success: false,
      errors: { general: ["Failed to create account. Please try again."] },
    };
  }
}

export async function signin(state, formData) {
  // Validate user input
  const parsedCredentials = z
    .object({
      email: z.string().email({ message: "Invalid email format" }),
      password: z
        .string()
        .min(4, { message: "Password must be at least 4 characters long" }),
    })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

  // Return validation errors if input is invalid
  if (!parsedCredentials.success) {
    return {
      success: false,
      errors: parsedCredentials.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsedCredentials.data;

  try {
    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return {
        success: false,
        errors: { email: ["User not found"] },
      };
    }

    // Check password
    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (!passwordsMatch) {
      return {
        success: false,
        errors: { password: ["Invalid credentials"] },
      };
    }

    // Create session and redirect
    await createSession(user.id, user.role);
    redirect("/dashboard");
  } catch (error) {
    // Only log errors that are not NEXT_REDIRECT
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    console.error("Error during signin:", error);
    return {
      success: false,
      errors: { general: ["Failed to sign in. Please try again."] },
    };
  }
}

export async function logout(logoutRoute) {
  await deleteSession();
  redirect(`/${logoutRoute}`);
}
