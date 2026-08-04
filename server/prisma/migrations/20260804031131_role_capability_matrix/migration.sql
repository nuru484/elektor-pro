-- CreateTable
CREATE TABLE "RoleCapability" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "capability" "Capability" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleCapability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoleCapability_role_idx" ON "RoleCapability"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RoleCapability_role_capability_key" ON "RoleCapability"("role", "capability");
