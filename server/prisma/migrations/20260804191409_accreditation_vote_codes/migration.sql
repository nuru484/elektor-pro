-- AlterTable
ALTER TABLE "Election" ADD COLUMN     "voteCodeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VoterElection" ADD COLUMN     "voteCodeHash" TEXT,
ADD COLUMN     "voteCodeIssuedAt" TIMESTAMP(3),
ADD COLUMN     "voteCodeUsedAt" TIMESTAMP(3);

