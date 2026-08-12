-- Agent & Commission Management, RE-COMM.2: Commission Calculation.
-- Additive: no existing table touched. Assumes "entities", "agents",
-- "agent_assignments", "unit_sale_allocations", "commission_plans",
-- "accounts", and "users" already exist.

-- CreateEnum
CREATE TYPE "CommissionBasisType" AS ENUM ('GROSS', 'NET');
CREATE TYPE "CommissionCollectionBasis" AS ENUM ('FULL', 'COLLECTED');
CREATE TYPE "CommissionCalculationStatus" AS ENUM ('CALCULATED', 'REVERSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "commission_calculations" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentAssignmentId" TEXT NOT NULL,
    "role" "AgentAssignmentRole" NOT NULL,
    "allocationId" TEXT NOT NULL,
    "commissionPlanId" TEXT NOT NULL,
    "planType" "CommissionPlanType" NOT NULL,
    "planWasTiered" BOOLEAN NOT NULL,
    "tierOrderApplied" INTEGER,
    "rateApplied" DECIMAL(9,4),
    "fixedAmountApplied" DECIMAL(18,2),
    "basisType" "CommissionBasisType" NOT NULL,
    "grossSaleValue" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netSaleValue" DECIMAL(18,2) NOT NULL,
    "commissionBasisAmount" DECIMAL(18,2) NOT NULL,
    "collectionBasis" "CommissionCollectionBasis" NOT NULL DEFAULT 'FULL',
    "collectedAmount" DECIMAL(18,2),
    "collectedPercent" DECIMAL(7,4),
    "proratedBasisAmount" DECIMAL(18,2) NOT NULL,
    "grossCommission" DECIMAL(18,2) NOT NULL,
    "whtApplied" BOOLEAN NOT NULL DEFAULT false,
    "whtRate" DECIMAL(6,4),
    "whtAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "whtAuthorityAccountId" TEXT,
    "netCommission" DECIMAL(18,2) NOT NULL,
    "status" "CommissionCalculationStatus" NOT NULL DEFAULT 'CALCULATED',
    "calculatedById" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reverseReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_calculations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "commission_calculations_entityId_idx" ON "commission_calculations"("entityId");
CREATE INDEX "commission_calculations_agentId_idx" ON "commission_calculations"("agentId");
CREATE INDEX "commission_calculations_agentAssignmentId_idx" ON "commission_calculations"("agentAssignmentId");
CREATE INDEX "commission_calculations_allocationId_idx" ON "commission_calculations"("allocationId");
CREATE INDEX "commission_calculations_commissionPlanId_idx" ON "commission_calculations"("commissionPlanId");
CREATE INDEX "commission_calculations_status_idx" ON "commission_calculations"("status");

-- AddForeignKey
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_agentAssignmentId_fkey" FOREIGN KEY ("agentAssignmentId") REFERENCES "agent_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "commission_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_whtAuthorityAccountId_fkey" FOREIGN KEY ("whtAuthorityAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
