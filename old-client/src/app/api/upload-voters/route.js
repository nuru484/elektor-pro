// src/app/api/upload-voters/route.js
import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import prisma from "@/config/prismaClient";
import { requireSuperAdmin } from "@/utils/auth";

// POST handler for uploading Excel file
export async function POST(req) {
  try {
    const user = await requireSuperAdmin();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized: SUPER_ADMIN access required." },
        { status: 403 }
      );
    }

    // Parse the form data
    const formData = await req.formData();
    const file = formData.get("file");
    const electionId = formData.get("electionId");

    // Validate file presence
    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "No file uploaded. Please upload an Excel file." },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const fileName = file.name.toLowerCase();
    const hasValidExtension =
      fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const hasValidMimeType = allowedMimes.includes(file.type);

    if (!hasValidExtension && !hasValidMimeType) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only Excel files (.xlsx, .xls) are allowed.",
        },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 5MB limit." },
        { status: 400 }
      );
    }

    // Validate electionId
    if (!electionId) {
      return NextResponse.json(
        { error: "Election ID is required in the request body." },
        { status: 400 }
      );
    }

    const electionIdNum = parseInt(electionId, 10);
    if (isNaN(electionIdNum)) {
      return NextResponse.json(
        { error: "Election ID must be a valid number." },
        { status: 400 }
      );
    }

    // Check if election exists
    const election = await prisma.election.findUnique({
      where: { id: electionIdNum },
    });
    if (!election) {
      return NextResponse.json(
        { error: `Election with ID ${electionIdNum} does not exist.` },
        { status: 404 }
      );
    }

    // Convert file to buffer for XLSX processing
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Validate Excel data
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "Excel file is empty or invalid." },
        { status: 400 }
      );
    }

    // Validate required fields and data format
    const requiredFields = ["name"];
    const validFields = ["name", "phoneNumber", "voterId"];
    const nameErrors = [];
    const phoneErrors = [];
    const voterIdErrors = [];
    const otherErrors = [];
    const voters = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel rows start at 1, plus header row

      // Check for required fields
      for (const field of requiredFields) {
        if (!row[field] || row[field].toString().trim() === "") {
          nameErrors.push(
            `Row ${rowNumber}: Missing required field "${field}".`
          );
        }
      }

      // Validate field names
      const invalidFields = Object.keys(row).filter(
        (key) => !validFields.includes(key)
      );
      if (invalidFields.length > 0) {
        otherErrors.push(
          `Row ${rowNumber}: Invalid fields found: ${invalidFields.join(
            ", "
          )}. Only ${validFields.join(", ")} are allowed.`
        );
      }

      // Validate phoneNumber format (if provided)
      if (row.phoneNumber) {
        const phoneRegex = /^\+?[0-9]\d{1,14}$/;
        if (!phoneRegex.test(row.phoneNumber.toString().trim())) {
          phoneErrors.push(
            `Row ${rowNumber}: Invalid phone number format for "${row.phoneNumber}".`
          );
        }
      }

      // Prepare voter data
      voters.push({
        name: row.name ? row.name.toString().trim() : "",
        phoneNumber: row.phoneNumber ? row.phoneNumber.toString().trim() : null,
        voterId: row.voterId ? row.voterId.toString().trim() : null,
      });
    }

    // Check for duplicates within the file
    const voterIds = voters.map((v) => v.voterId).filter(Boolean);
    const phoneNumbers = voters.map((v) => v.phoneNumber).filter(Boolean);
    const duplicateVoterIds = voterIds.filter(
      (id, index) => voterIds.indexOf(id) !== index
    );
    const duplicatePhoneNumbers = phoneNumbers.filter(
      (num, index) => phoneNumbers.indexOf(num) !== index
    );

    if (duplicateVoterIds.length > 0) {
      voterIdErrors.push(
        `Duplicate voter IDs found in file: ${[
          ...new Set(duplicateVoterIds),
        ].join(", ")}.`
      );
    }
    if (duplicatePhoneNumbers.length > 0) {
      phoneErrors.push(
        `Duplicate phone numbers found in file: ${[
          ...new Set(duplicatePhoneNumbers),
        ].join(", ")}.`
      );
    }

    // Combine validation errors
    const allErrors = [
      ...nameErrors,
      ...phoneErrors,
      ...voterIdErrors,
      ...otherErrors,
    ];

    if (allErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation errors in Excel file", details: allErrors },
        { status: 400 }
      );
    }

    // Check for existing voters in the database (based on voterId or phoneNumber)
    const existingVoters = await prisma.voter.findMany({
      where: {
        OR: [
          { voterId: { in: voterIds } },
          { phoneNumber: { in: phoneNumbers } },
        ],
      },
      select: { id: true, voterId: true, phoneNumber: true },
    });

    // Check for existing voter-election associations
    const existingVoterElections = await prisma.voterElection.findMany({
      where: {
        electionId: electionIdNum,
        voterId: { in: existingVoters.map((v) => v.id) },
      },
      select: { voterId: true },
    });

    const existingVoterIds = existingVoters
      .map((v) => v.voterId)
      .filter(Boolean);
    const existingPhoneNumbers = existingVoters
      .map((v) => v.phoneNumber)
      .filter(Boolean);
    const existingVoterElectionVoterIds = existingVoterElections.map(
      (ve) => ve.voterId
    );

    // Filter out voters that already exist or are already associated with the election
    const newVoters = voters.filter(
      (voter) =>
        !(voter.voterId && existingVoterIds.includes(voter.voterId)) &&
        !(voter.phoneNumber && existingPhoneNumbers.includes(voter.phoneNumber))
    );

    // If no new voters, check if any existing voters need to be associated with the election
    if (newVoters.length === 0) {
      const existingVotersToAssociate = existingVoters.filter(
        (v) => !existingVoterElectionVoterIds.includes(v.id)
      );
      if (existingVotersToAssociate.length > 0) {
        const voterElectionData = existingVotersToAssociate
          .filter(
            (v) =>
              voterIds.includes(v.voterId) ||
              phoneNumbers.includes(v.phoneNumber)
          )
          .map((v) => ({
            voterId: v.id,
            electionId: electionIdNum,
            hasVoted: false,
          }));

        if (voterElectionData.length > 0) {
          await prisma.voterElection.createMany({
            data: voterElectionData,
            skipDuplicates: true,
          });
          return NextResponse.json(
            {
              message: `Voter list updated: ${voterElectionData.length} existing voters associated with election ID ${electionIdNum}.`,
            },
            { status: 201 }
          );
        }
      }
      return NextResponse.json(
        {
          message: "Voters are already up to date with the uploaded file.",
        },
        { status: 200 }
      );
    }

    // Insert new voters into the database and associate with the election
    const createdVoters = await prisma.$transaction(async (tx) => {
      const newVoterRecords = await tx.voter.createMany({
        data: newVoters,
        skipDuplicates: true,
      });

      // Fetch the newly created voters to get their IDs
      const newlyCreatedVoters = await tx.voter.findMany({
        where: {
          OR: [
            {
              voterId: { in: newVoters.map((v) => v.voterId).filter(Boolean) },
            },
            {
              phoneNumber: {
                in: newVoters.map((v) => v.phoneNumber).filter(Boolean),
              },
            },
          ],
        },
        select: { id: true, voterId: true, phoneNumber: true },
      });

      // Create VoterElection records for new voters
      const voterElectionData = newlyCreatedVoters.map((voter) => ({
        voterId: voter.id,
        electionId: electionIdNum,
        hasVoted: false,
      }));

      await tx.voterElection.createMany({
        data: voterElectionData,
        skipDuplicates: true,
      });

      return newVoterRecords;
    });

    return NextResponse.json(
      {
        message: `Voter list updated: ${createdVoters.count} new voters added and associated with election ID ${electionIdNum}.`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error processing upload:", error);

    // Handle database errors
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "Database conflict: Some voter IDs or phone numbers already exist.",
        },
        { status: 409 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: "An unexpected error occurred while processing the upload." },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
