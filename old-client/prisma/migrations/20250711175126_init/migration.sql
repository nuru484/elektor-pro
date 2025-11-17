/*
  Warnings:

  - A unique constraint covering the columns `[voterId]` on the table `Voter` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Voter" ADD COLUMN     "voterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Voter_voterId_key" ON "Voter"("voterId");
