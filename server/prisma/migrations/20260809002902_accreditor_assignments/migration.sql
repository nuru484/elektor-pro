-- CreateTable
CREATE TABLE "AccreditorAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccreditorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccreditorAssignment_electionId_idx" ON "AccreditorAssignment"("electionId");

-- CreateIndex
CREATE INDEX "AccreditorAssignment_userId_idx" ON "AccreditorAssignment"("userId");

-- CreateIndex
CREATE INDEX "AccreditorAssignment_deletedAt_idx" ON "AccreditorAssignment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccreditorAssignment_userId_electionId_key" ON "AccreditorAssignment"("userId", "electionId");

-- AddForeignKey
ALTER TABLE "AccreditorAssignment" ADD CONSTRAINT "AccreditorAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccreditorAssignment" ADD CONSTRAINT "AccreditorAssignment_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
