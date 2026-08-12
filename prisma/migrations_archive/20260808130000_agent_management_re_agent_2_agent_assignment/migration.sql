-- Agent & Commission Management, RE-AGENT.2: Agent Assignment. Additive:
-- no existing table touched. Assumes "agents" (RE-AGENT.1), "entities",
-- "users", "projects", "units", and "unit_sale_allocations" already exist.

-- CreateEnum
CREATE TYPE "AgentAssignmentScope" AS ENUM ('PROJECT', 'UNIT', 'SALE');
CREATE TYPE "AgentAssignmentRole" AS ENUM ('PRIMARY', 'CO_AGENT', 'REFERRAL');

-- CreateTable
CREATE TABLE "agent_assignments" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "scope" "AgentAssignmentScope" NOT NULL,
    "role" "AgentAssignmentRole" NOT NULL,
    "projectId" TEXT,
    "unitId" TEXT,
    "allocationId" TEXT,
    "entityId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "endedById" TEXT,
    "notes" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "agent_assignments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "agent_assignments_agentId_idx" ON "agent_assignments"("agentId");
CREATE INDEX "agent_assignments_entityId_idx" ON "agent_assignments"("entityId");
CREATE INDEX "agent_assignments_projectId_idx" ON "agent_assignments"("projectId");
CREATE INDEX "agent_assignments_unitId_idx" ON "agent_assignments"("unitId");
CREATE INDEX "agent_assignments_allocationId_idx" ON "agent_assignments"("allocationId");
CREATE INDEX "agent_assignments_scope_role_isActive_idx" ON "agent_assignments"("scope", "role", "isActive");

-- AddForeignKey
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_assignments" ADD CONSTRAINT "agent_assignments_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
