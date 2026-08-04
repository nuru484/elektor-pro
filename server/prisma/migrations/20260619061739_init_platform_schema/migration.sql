-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'AGENT', 'CANDIDATE', 'VOTER');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOCKED');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'PAUSED', 'ENDED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ResultsPolicy" AS ENUM ('LIVE', 'ON_CLOSE', 'MANUAL');

-- CreateEnum
CREATE TYPE "EligibilityMode" AS ENUM ('ALL_VOTERS', 'ROLL');

-- CreateEnum
CREATE TYPE "PortfolioEligibilityMode" AS ENUM ('ALL_VOTERS', 'ANY_OF_GROUPS', 'ALL_OF_GROUPS');

-- CreateEnum
CREATE TYPE "VotingMethod" AS ENUM ('SINGLE_CHOICE', 'MULTI_SELECT', 'YES_NO');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('VOTER_LOGIN');

-- CreateEnum
CREATE TYPE "BallotEntryType" AS ENUM ('VOTE', 'SKIP', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "ChangeAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChangeEntity" AS ENUM ('ORGANIZATION', 'ELECTION', 'PORTFOLIO', 'CANDIDATE', 'VOTER', 'AGENT', 'USER', 'GROUP_CATEGORY', 'GROUP');

-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('VIEW_RESULTS', 'MANAGE_ELECTIONS', 'MANAGE_PORTFOLIOS', 'MANAGE_CANDIDATES', 'MANAGE_VOTERS', 'MANAGE_AGENTS', 'MANAGE_GROUPS', 'MANAGE_ORGANIZATION', 'APPROVE_CHANGES', 'CERTIFY_RESULTS', 'ACCREDIT_VOTERS');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#111827',
    "accentColor" TEXT NOT NULL DEFAULT '#2563eb',
    "supportEmail" TEXT,
    "supportPhone" TEXT,
    "website" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "settings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'ADMIN',
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "profilePicture" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedReason" TEXT,
    "unlockedById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorRecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwoFactorRecoveryCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'VOTER_LOGIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "allowMultiple" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterGroupMembership" (
    "id" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoterGroupMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voter" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "email" TEXT,
    "profilePicture" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "eligibilityMode" "EligibilityMode" NOT NULL DEFAULT 'ALL_VOTERS',
    "resultsPolicy" "ResultsPolicy" NOT NULL DEFAULT 'ON_CLOSE',
    "resultsPublishedAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),
    "certifiedById" TEXT,
    "accreditationRequired" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "votingMethod" "VotingMethod" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "maxSelections" INTEGER NOT NULL DEFAULT 1,
    "allowAbstain" BOOLEAN NOT NULL DEFAULT true,
    "eligibility" "PortfolioEligibilityMode" NOT NULL DEFAULT 'ALL_VOTERS',
    "electionId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioEligibility" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profilePicture" TEXT,
    "party" TEXT,
    "partySymbol" TEXT,
    "manifesto" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "electionId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "candidateId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoterElection" (
    "id" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "isEligible" BOOLEAN NOT NULL DEFAULT true,
    "accreditedAt" TIMESTAMP(3),
    "accreditedById" TEXT,
    "hasVoted" BOOLEAN NOT NULL DEFAULT false,
    "votedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoterElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ballot" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "receiptCode" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ballot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BallotEntry" (
    "id" TEXT NOT NULL,
    "ballotId" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "candidateId" TEXT,
    "type" "BallotEntryType" NOT NULL DEFAULT 'VOTE',
    "approve" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BallotEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capability" "Capability" NOT NULL,
    "electionId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL,
    "action" "ChangeAction" NOT NULL,
    "entity" "ChangeEntity" NOT NULL,
    "entityId" TEXT,
    "payload" JSONB NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "appliedAt" TIMESTAMP(3),
    "resultId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultSnapshot" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "certifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "sequence" SERIAL NOT NULL,
    "actorId" TEXT,
    "actorRole" "Role",
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "prevHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_status_idx" ON "User"("status");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "User_createdById_idx" ON "User"("createdById");

-- CreateIndex
CREATE INDEX "TwoFactorRecoveryCode_userId_idx" ON "TwoFactorRecoveryCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Otp_userId_idx" ON "Otp"("userId");

-- CreateIndex
CREATE INDEX "Otp_expiresAt_idx" ON "Otp"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GroupCategory_name_key" ON "GroupCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupCategory_code_key" ON "GroupCategory"("code");

-- CreateIndex
CREATE INDEX "GroupCategory_deletedAt_idx" ON "GroupCategory"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Group_code_key" ON "Group"("code");

-- CreateIndex
CREATE INDEX "Group_categoryId_idx" ON "Group"("categoryId");

-- CreateIndex
CREATE INDEX "Group_parentId_idx" ON "Group"("parentId");

-- CreateIndex
CREATE INDEX "Group_deletedAt_idx" ON "Group"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Group_categoryId_name_key" ON "Group"("categoryId", "name");

-- CreateIndex
CREATE INDEX "VoterGroupMembership_voterId_idx" ON "VoterGroupMembership"("voterId");

-- CreateIndex
CREATE INDEX "VoterGroupMembership_groupId_idx" ON "VoterGroupMembership"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "VoterGroupMembership_voterId_groupId_key" ON "VoterGroupMembership"("voterId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Voter_userId_key" ON "Voter"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Voter_voterId_key" ON "Voter"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "Voter_phoneNumber_key" ON "Voter"("phoneNumber");

-- CreateIndex
CREATE INDEX "Voter_deletedAt_idx" ON "Voter"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Election_slug_key" ON "Election"("slug");

-- CreateIndex
CREATE INDEX "Election_status_idx" ON "Election"("status");

-- CreateIndex
CREATE INDEX "Election_deletedAt_idx" ON "Election"("deletedAt");

-- CreateIndex
CREATE INDEX "Election_startDate_idx" ON "Election"("startDate");

-- CreateIndex
CREATE INDEX "Election_endDate_idx" ON "Election"("endDate");

-- CreateIndex
CREATE INDEX "Election_createdById_idx" ON "Election"("createdById");

-- CreateIndex
CREATE INDEX "Portfolio_electionId_idx" ON "Portfolio"("electionId");

-- CreateIndex
CREATE INDEX "Portfolio_deletedAt_idx" ON "Portfolio"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_electionId_name_key" ON "Portfolio"("electionId", "name");

-- CreateIndex
CREATE INDEX "PortfolioEligibility_portfolioId_idx" ON "PortfolioEligibility"("portfolioId");

-- CreateIndex
CREATE INDEX "PortfolioEligibility_groupId_idx" ON "PortfolioEligibility"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioEligibility_portfolioId_groupId_key" ON "PortfolioEligibility"("portfolioId", "groupId");

-- CreateIndex
CREATE INDEX "Candidate_electionId_idx" ON "Candidate"("electionId");

-- CreateIndex
CREATE INDEX "Candidate_portfolioId_idx" ON "Candidate"("portfolioId");

-- CreateIndex
CREATE INDEX "Candidate_accountId_idx" ON "Candidate"("accountId");

-- CreateIndex
CREATE INDEX "Candidate_deletedAt_idx" ON "Candidate"("deletedAt");

-- CreateIndex
CREATE INDEX "AgentAssignment_electionId_idx" ON "AgentAssignment"("electionId");

-- CreateIndex
CREATE INDEX "AgentAssignment_userId_idx" ON "AgentAssignment"("userId");

-- CreateIndex
CREATE INDEX "AgentAssignment_deletedAt_idx" ON "AgentAssignment"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAssignment_userId_electionId_candidateId_key" ON "AgentAssignment"("userId", "electionId", "candidateId");

-- CreateIndex
CREATE INDEX "VoterElection_electionId_idx" ON "VoterElection"("electionId");

-- CreateIndex
CREATE INDEX "VoterElection_voterId_idx" ON "VoterElection"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "VoterElection_voterId_electionId_key" ON "VoterElection"("voterId", "electionId");

-- CreateIndex
CREATE UNIQUE INDEX "Ballot_receiptCode_key" ON "Ballot"("receiptCode");

-- CreateIndex
CREATE UNIQUE INDEX "Ballot_hash_key" ON "Ballot"("hash");

-- CreateIndex
CREATE INDEX "Ballot_electionId_idx" ON "Ballot"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "Ballot_electionId_sequence_key" ON "Ballot"("electionId", "sequence");

-- CreateIndex
CREATE INDEX "BallotEntry_ballotId_idx" ON "BallotEntry"("ballotId");

-- CreateIndex
CREATE INDEX "BallotEntry_portfolioId_idx" ON "BallotEntry"("portfolioId");

-- CreateIndex
CREATE INDEX "BallotEntry_candidateId_idx" ON "BallotEntry"("candidateId");

-- CreateIndex
CREATE INDEX "BallotEntry_type_idx" ON "BallotEntry"("type");

-- CreateIndex
CREATE UNIQUE INDEX "BallotEntry_ballotId_portfolioId_candidateId_key" ON "BallotEntry"("ballotId", "portfolioId", "candidateId");

-- CreateIndex
CREATE INDEX "AccessGrant_userId_idx" ON "AccessGrant"("userId");

-- CreateIndex
CREATE INDEX "AccessGrant_electionId_idx" ON "AccessGrant"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessGrant_userId_capability_electionId_key" ON "AccessGrant"("userId", "capability", "electionId");

-- CreateIndex
CREATE INDEX "ChangeRequest_status_idx" ON "ChangeRequest"("status");

-- CreateIndex
CREATE INDEX "ChangeRequest_entity_entityId_idx" ON "ChangeRequest"("entity", "entityId");

-- CreateIndex
CREATE INDEX "ChangeRequest_requestedById_idx" ON "ChangeRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ChangeRequest_createdAt_idx" ON "ChangeRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResultSnapshot_hash_key" ON "ResultSnapshot"("hash");

-- CreateIndex
CREATE INDEX "ResultSnapshot_electionId_idx" ON "ResultSnapshot"("electionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_sequence_key" ON "AuditLog"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_hash_key" ON "AuditLog"("hash");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_unlockedById_fkey" FOREIGN KEY ("unlockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TwoFactorRecoveryCode" ADD CONSTRAINT "TwoFactorRecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Otp" ADD CONSTRAINT "Otp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GroupCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterGroupMembership" ADD CONSTRAINT "VoterGroupMembership_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterGroupMembership" ADD CONSTRAINT "VoterGroupMembership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voter" ADD CONSTRAINT "Voter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioEligibility" ADD CONSTRAINT "PortfolioEligibility_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioEligibility" ADD CONSTRAINT "PortfolioEligibility_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAssignment" ADD CONSTRAINT "AgentAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAssignment" ADD CONSTRAINT "AgentAssignment_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAssignment" ADD CONSTRAINT "AgentAssignment_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterElection" ADD CONSTRAINT "VoterElection_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Voter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoterElection" ADD CONSTRAINT "VoterElection_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ballot" ADD CONSTRAINT "Ballot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallotEntry" ADD CONSTRAINT "BallotEntry_ballotId_fkey" FOREIGN KEY ("ballotId") REFERENCES "Ballot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallotEntry" ADD CONSTRAINT "BallotEntry_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallotEntry" ADD CONSTRAINT "BallotEntry_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessGrant" ADD CONSTRAINT "AccessGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeRequest" ADD CONSTRAINT "ChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSnapshot" ADD CONSTRAINT "ResultSnapshot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultSnapshot" ADD CONSTRAINT "ResultSnapshot_certifiedById_fkey" FOREIGN KEY ("certifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
