-- Phase 5A: Mortgage Management / Handover Workflow / Snag Lists / Defect
-- Tracking. Purely additive: no existing table is altered. Assumes
-- "entities", "units", "customers", "users", and "unit_sale_allocations"
-- already exist (see prior phase migrations).

-- CreateEnum
CREATE TYPE "MortgageStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'DECLINED', 'DISBURSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('SCHEDULED', 'INSPECTION_DONE', 'SNAGS_PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SnagSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SnagStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SnagSource" AS ENUM ('HANDOVER_INSPECTION', 'POST_HANDOVER_REPORT');

-- CreateTable
CREATE TABLE "mortgage_applications" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "amountApplied" DECIMAL(18,2) NOT NULL,
    "amountApproved" DECIMAL(18,2),
    "interestRatePercent" DECIMAL(6,3),
    "tenorMonths" INTEGER,
    "status" "MortgageStatus" NOT NULL DEFAULT 'DRAFT',
    "applicationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvalDate" TIMESTAMP(3),
    "declineReason" TEXT,
    "disbursementDate" TIMESTAMP(3),
    "disbursedAmount" DECIMAL(18,2),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mortgage_applications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mortgage_applications_allocationId_idx" ON "mortgage_applications"("allocationId");
CREATE INDEX "mortgage_applications_entityId_status_idx" ON "mortgage_applications"("entityId", "status");

-- CreateTable
CREATE TABLE "handover_records" (
    "id" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "HandoverStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "inspectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "customerSignedAt" TIMESTAMP(3),
    "handedOverById" TEXT,
    "cancelledReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handover_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "handover_records_allocationId_key" ON "handover_records"("allocationId");
CREATE INDEX "handover_records_status_idx" ON "handover_records"("status");
CREATE INDEX "handover_records_entityId_idx" ON "handover_records"("entityId");

-- CreateTable
CREATE TABLE "snag_items" (
    "id" TEXT NOT NULL,
    "handoverRecordId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT NOT NULL,
    "severity" "SnagSeverity" NOT NULL DEFAULT 'MINOR',
    "status" "SnagStatus" NOT NULL DEFAULT 'OPEN',
    "source" "SnagSource" NOT NULL DEFAULT 'HANDOVER_INSPECTION',
    "reportedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snag_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "snag_items_handoverRecordId_idx" ON "snag_items"("handoverRecordId");
CREATE INDEX "snag_items_unitId_status_idx" ON "snag_items"("unitId", "status");

-- AddForeignKey
ALTER TABLE "mortgage_applications" ADD CONSTRAINT "mortgage_applications_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_applications" ADD CONSTRAINT "mortgage_applications_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mortgage_applications" ADD CONSTRAINT "mortgage_applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_handedOverById_fkey" FOREIGN KEY ("handedOverById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_handoverRecordId_fkey" FOREIGN KEY ("handoverRecordId") REFERENCES "handover_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "snag_items" ADD CONSTRAINT "snag_items_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
