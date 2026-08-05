-- Open-ballot option, per election.
--
-- Off (the default) an election is a secret ballot: nothing links a voter to
-- their ballot, so not even database access reveals how anyone voted.
--
-- On, the voter's receipt is stored against their record so their console can
-- replay what they voted. That is a change of election TYPE, not a display
-- preference: the stored link makes the election an open (roll-call) ballot.
-- Legitimate for a board or committee vote; wrong wherever a voter could be
-- pressured. The ballot screen says which kind of election the voter is in
-- before they cast, and turning the setting off purges the stored links.
ALTER TABLE "Election" ADD COLUMN "voteVisibleToVoter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VoterElection" ADD COLUMN "receiptCode" TEXT;
