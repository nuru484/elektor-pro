// src/app/api/voters/otp/send/route.js
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { sendOTP } from "@/config/OtpSetup";

export async function POST(request) {
  try {
    const { voterId } = await request.json();

    if (!voterId) {
      return NextResponse.json(
        { success: false, errors: { voterId: ["Voter ID is required"] } },
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

    // Send OTP to voter's phone number
    await sendOTP(voter.phoneNumber);

    return NextResponse.json(
      { success: true, message: "Sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error sending OTP:", error);
    return NextResponse.json(
      {
        success: false,
        errors: { general: ["Failed to send OTP. Please try again later."] },
      },
      { status: 500 }
    );
  }
}
