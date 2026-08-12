-- Phase 5A: Facility Management / Maintenance Requests (Release D).
-- Purely additive: no existing table is altered. Assumes "entities",
-- "projects", "units", "vendors", "users", "tenants", and
-- "vendor_invoices" already exist (see prior phase migrations).

-- CreateEnum
CREATE TYPE "FacilityCategory" AS ENUM ('MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'SECURITY', 'STRUCTURAL', 'AMENITY', 'OTHER');

-- CreateEnum
CREATE TYPE "FacilityStatus" AS ENUM ('OPERATIONAL', 'UNDER_MAINTENANCE', 'OUT_OF_SERVICE', 'DECOMMISSIONED');

-- CreateEnum
CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MaintenanceRequestSource" AS ENUM ('TENANT_REPORTED', 'FACILITY_INSPECTION', 'INTERNAL');

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "unitId" TEXT,
    "name" TEXT NOT NULL,
    "category" "FacilityCategory" NOT NULL,
    "description" TEXT,
    "status" "FacilityStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "vendorId" TEXT,
    "installDate" TIMESTAMP(3),
    "lastServicedAt" TIMESTAMP(3),
    "nextServiceDueAt" TIMESTAMP(3),
    "decommissionedAt" TIMESTAMP(3),
    "decommissionReason" TEXT,
    "workflowInstanceId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "facilities_entityId_status_idx" ON "facilities"("entityId", "status");
CREATE INDEX "facilities_projectId_idx" ON "facilities"("projectId");
CREATE INDEX "facilities_unitId_idx" ON "facilities"("unitId");

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "facilityId" TEXT,
    "unitId" TEXT,
    "tenantId" TEXT,
    "category" "FacilityCategory" NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "source" "MaintenanceRequestSource" NOT NULL DEFAULT 'INTERNAL',
    "description" TEXT NOT NULL,
    "status" "MaintenanceRequestStatus" NOT NULL DEFAULT 'OPEN',
    "reportedById" TEXT NOT NULL,
    "assignedVendorId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "targetResolutionDate" TIMESTAMP(3),
    "costEstimate" DECIMAL(18,2),
    "actualCost" DECIMAL(18,2),
    "vendorInvoiceId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "closedAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "maintenance_requests_vendorInvoiceId_key" ON "maintenance_requests"("vendorInvoiceId");
CREATE INDEX "maintenance_requests_entityId_status_idx" ON "maintenance_requests"("entityId", "status");
CREATE INDEX "maintenance_requests_facilityId_idx" ON "maintenance_requests"("facilityId");
CREATE INDEX "maintenance_requests_unitId_idx" ON "maintenance_requests"("unitId");
CREATE INDEX "maintenance_requests_tenantId_idx" ON "maintenance_requests"("tenantId");

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_vendorInvoiceId_fkey" FOREIGN KEY ("vendorInvoiceId") REFERENCES "vendor_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
