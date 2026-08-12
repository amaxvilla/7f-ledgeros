-- Agent & Commission Management, RE-COMM.1: Commission Plans. Additive:
-- no existing table touched. Assumes "entities", "projects", "estates",
-- "units", "agents", and "users" already exist.

-- CreateEnum
CREATE TYPE "CommissionPlanType" AS ENUM ('PERCENTAGE', 'FIXED');
CREATE TYPE "CommissionPlanScope" AS ENUM ('GLOBAL', 'PROJECT', 'ESTATE', 'UNIT', 'AGENT');
CREATE TYPE "CommissionPlanStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "commission_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CommissionPlanType" NOT NULL,
    "scope" "CommissionPlanScope" NOT NULL,
    "status" "CommissionPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "estateId" TEXT,
    "unitId" TEXT,
    "agentId" TEXT,
    "rate" DECIMAL(9,4),
    "fixedAmount" DECIMAL(18,2),
    "isReferral" BOOLEAN NOT NULL DEFAULT false,
    "isTiered" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deactivatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivateReason" TEXT,

    CONSTRAINT "commission_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commission_plans_code_key" ON "commission_plans"("code");
CREATE INDEX "commission_plans_entityId_idx" ON "commission_plans"("entityId");
CREATE INDEX "commission_plans_scope_idx" ON "commission_plans"("scope");
CREATE INDEX "commission_plans_projectId_idx" ON "commission_plans"("projectId");
CREATE INDEX "commission_plans_estateId_idx" ON "commission_plans"("estateId");
CREATE INDEX "commission_plans_unitId_idx" ON "commission_plans"("unitId");
CREATE INDEX "commission_plans_agentId_idx" ON "commission_plans"("agentId");
CREATE INDEX "commission_plans_status_idx" ON "commission_plans"("status");
CREATE INDEX "commission_plans_isReferral_idx" ON "commission_plans"("isReferral");

-- CreateTable
CREATE TABLE "commission_plan_tiers" (
    "id" TEXT NOT NULL,
    "commissionPlanId" TEXT NOT NULL,
    "tierOrder" INTEGER NOT NULL,
    "minAmount" DECIMAL(18,2) NOT NULL,
    "maxAmount" DECIMAL(18,2),
    "rate" DECIMAL(9,4),
    "fixedAmount" DECIMAL(18,2),

    CONSTRAINT "commission_plan_tiers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "commission_plan_tiers_commissionPlanId_tierOrder_key" ON "commission_plan_tiers"("commissionPlanId", "tierOrder");

-- AddForeignKey
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "estates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_plans" ADD CONSTRAINT "commission_plans_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_plan_tiers" ADD CONSTRAINT "commission_plan_tiers_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "commission_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
