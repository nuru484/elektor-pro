-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'QUALIFIED', 'DISQUALIFIED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "Capability" ADD VALUE 'VET_CANDIDATES';

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "ballotNumber" INTEGER,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "CandidateStatus" NOT NULL DEFAULT 'QUALIFIED',
ADD COLUMN     "vettingNote" TEXT;

-- AlterTable
ALTER TABLE "Election" ADD COLUMN     "vettingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VettingCriterion" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VettingCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VettingScore" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "scoredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VettingScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VettingCriterion_electionId_idx" ON "VettingCriterion"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "VettingCriterion_electionId_name_key" ON "VettingCriterion"("electionId", "name");

-- CreateIndex
CREATE INDEX "VettingScore_candidateId_idx" ON "VettingScore"("candidateId");

-- CreateIndex
CREATE INDEX "VettingScore_criterionId_idx" ON "VettingScore"("criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "VettingScore_candidateId_criterionId_scoredById_key" ON "VettingScore"("candidateId", "criterionId", "scoredById");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_portfolioId_ballotNumber_key" ON "Candidate"("portfolioId", "ballotNumber");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VettingCriterion" ADD CONSTRAINT "VettingCriterion_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VettingScore" ADD CONSTRAINT "VettingScore_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VettingScore" ADD CONSTRAINT "VettingScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "VettingCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VettingScore" ADD CONSTRAINT "VettingScore_scoredById_fkey" FOREIGN KEY ("scoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

