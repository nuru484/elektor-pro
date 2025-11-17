/*
  Warnings:

  - You are about to drop the column `electionId` on the `Voter` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Voter" DROP CONSTRAINT "Voter_electionId_fkey";

-- AlterTable
ALTER TABLE "Voter" DROP COLUMN "electionId";

-- CreateTable
CREATE TABLE "VoterElection" (
    "id" SERIAL NOT NULL,
    "voterId" INTEGER NOT NULL,
    "electionId" INTEGER NOT NULL,
    "hasVoted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoterElection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoterElection_voterId_electionId_key" ON "VoterElection"("voterId", "electionId");

-- AddForeignKey
ALTER TABLE "VoterElection" ADD CONSTRAINT "VoterElection_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterElection" ADD CONSTRAINT "VoterElection_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
