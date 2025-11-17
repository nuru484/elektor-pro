-- CreateEnum
CREATE TYPE "VoteActionType" AS ENUM ('VOTE', 'SKIP');

-- CreateTable
CREATE TABLE "VoteAction" (
    "id" SERIAL NOT NULL,
    "voterId" INTEGER NOT NULL,
    "electionId" INTEGER NOT NULL,
    "portfolioId" INTEGER,
    "candidateId" INTEGER,
    "actionType" "VoteActionType" NOT NULL DEFAULT 'VOTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoteAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoteAction_voterId_electionId_portfolioId_key" ON "VoteAction"("voterId", "electionId", "portfolioId");

-- AddForeignKey
ALTER TABLE "VoteAction" ADD CONSTRAINT "VoteAction_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteAction" ADD CONSTRAINT "VoteAction_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteAction" ADD CONSTRAINT "VoteAction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteAction" ADD CONSTRAINT "VoteAction_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
