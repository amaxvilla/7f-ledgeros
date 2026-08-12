-- Phase 5A: Tenant Management / Lease Management. Purely additive: no
-- existing table is altered. Assumes "entities", "units", "customers",
-- "users", and "ar_invoices" already exist (see prior phase migrations).

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'FORMER');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "LeaseRentFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "moveInDate" TIMESTAMP(3) NOT NULL,
    "moveOutDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "tenants_entityId_status_idx" ON "tenants"("entityId", "status");
CREATE INDEX "tenants_unitId_status_idx" ON "tenants"("unitId", "status");
CREATE INDEX "tenants_customerId_idx" ON "tenants"("customerId");

-- CreateTable
CREATE TABLE "leases" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "leaseNumber" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "rentAmount" DECIMAL(18,2) NOT NULL,
    "rentFrequency" "LeaseRentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "depositAmount" DECIMAL(18,2),
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "terminatedAt" TIMESTAMP(3),
    "terminationReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leases_entityId_leaseNumber_key" ON "leases"("entityId", "leaseNumber");
CREATE INDEX "leases_entityId_status_idx" ON "leases"("entityId", "status");
CREATE INDEX "leases_tenantId_idx" ON "leases"("tenantId");
CREATE INDEX "leases_unitId_status_idx" ON "leases"("unitId", "status");

-- CreateTable
CREATE TABLE "lease_rent_invoices" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "arInvoiceId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lease_rent_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lease_rent_invoices_arInvoiceId_key" ON "lease_rent_invoices"("arInvoiceId");
CREATE INDEX "lease_rent_invoices_leaseId_idx" ON "lease_rent_invoices"("leaseId");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leases" ADD CONSTRAINT "leases_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leases" ADD CONSTRAINT "leases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_rent_invoices" ADD CONSTRAINT "lease_rent_invoices_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lease_rent_invoices" ADD CONSTRAINT "lease_rent_invoices_arInvoiceId_fkey" FOREIGN KEY ("arInvoiceId") REFERENCES "ar_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
