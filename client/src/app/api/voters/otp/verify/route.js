// src/app/api/voters/otp/verify/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { verifyOTP } from "@/config/OtpSetup";
import { createSession } from "@/lib/session";

export async function POST(request) {
  try {
    const body = await request.json();
    const { voterId, otp } = body;

    if (!voterId || !otp) {
      console.log("Missing voterId or otp");
      return NextResponse.json(
        {
          success: false,
          errors: { general: ["Voter ID and OTP are required"] },
        },
        { status: 400 }
      );
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { success: false, errors: { otp: ["OTP must be a 6-digit number"] } },
        { status: 400 }
      );
    }

    // Fetch voter from database
    const voter = await prisma.voter.findUnique({
      where: { voterId },
    });

    if (!voter) {
      return NextResponse.json(
        { success: false, errors: { voterId: ["Voter not found"] } },
        { status: 404 }
      );
    }

    if (!voter.phoneNumber) {
      return NextResponse.json(
        {
          success: false,
          errors: {
            general: ["No phone number associated with this voter ID"],
          },
        },
        { status: 400 }
      );
    }

    // Verify OTP
    const otpResponse = await verifyOTP(otp, voter.phoneNumber);

    if (otpResponse.status !== "SUCCESS") {
      console.log("OTP verification failed:", otpResponse);

      const errorMessage = otpResponse.message || "Failed to verify OTP";
      return NextResponse.json(
        { success: false, errors: { otp: [errorMessage] } },
        { status: 400 }
      );
    }

    // Create session for voter
    await createSession(voter.voterId, "VOTER");

    return NextResponse.json(
      { success: true, message: "Login successful" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in OTP verification:", error);
    return NextResponse.json(
      {
        success: false,
        errors: { general: ["Unexpected error during OTP verification"] },
      },
      { status: 500 }
    );
  }
}
