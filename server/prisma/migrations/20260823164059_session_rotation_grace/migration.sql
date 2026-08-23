-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "previousTokenHash" TEXT,
ADD COLUMN     "rotatedAt" TIMESTAMP(3);
