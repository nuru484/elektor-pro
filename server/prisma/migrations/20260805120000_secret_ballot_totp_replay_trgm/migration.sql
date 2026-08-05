-- Secret ballot: drop the voter -> ballot link.
-- Storing the voter's receipt code against their identity let a single join
-- (VoterElection.receiptCode = Ballot.receiptCode) reconstruct how every named
-- voter voted, which defeats the secret ballot. The receipt is now shown to the
-- voter once, at cast time, and only they hold it.
ALTER TABLE "VoterElection" DROP COLUMN "receiptCode";

-- TOTP replay prevention: record the highest time step already accepted so a
-- code cannot be reused inside its +/-1-step drift window.
ALTER TABLE "User" ADD COLUMN "totpLastCounter" INTEGER;

-- Voter search is `contains` + case-insensitive (accreditation desk, roll,
-- register). A B-tree cannot serve that, so at register scale every keystroke
-- was a sequential scan. Trigram GIN indexes turn them into index scans.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Voter_name_idx" ON "Voter" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Voter_voterId_idx" ON "Voter" USING GIN ("voterId" gin_trgm_ops);
CREATE INDEX "Voter_phoneNumber_idx" ON "Voter" USING GIN ("phoneNumber" gin_trgm_ops);
