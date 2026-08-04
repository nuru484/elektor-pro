-- AlterEnum
ALTER TYPE "EligibilityMode" ADD VALUE 'GROUPS';

-- CreateTable
CREATE TABLE "ElectionEligibility" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElectionEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ElectionEligibility_groupId_idx" ON "ElectionEligibility"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionEligibility_electionId_groupId_key" ON "ElectionEligibility"("electionId", "groupId");

-- AddForeignKey
ALTER TABLE "ElectionEligibility" ADD CONSTRAINT "ElectionEligibility_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionEligibility" ADD CONSTRAINT "ElectionEligibility_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

