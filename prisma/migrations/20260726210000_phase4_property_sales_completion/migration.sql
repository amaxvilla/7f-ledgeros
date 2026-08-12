-- Phase 4: Property Sales completion — reservation workflow (with expiry),
-- sale cancellation, transfer/swap lineage, and an append-only allocation
-- event audit trail. Purely additive: new tables, plus new nullable/
-- defaulted columns on "unit_sale_allocations" only.
--
-- KNOWN RISK (inherited, not fixed — this repo's migration history still
-- has no baseline migration for its ~160+ pre-existing tables; every
-- migration file including this one assumes those tables already exist).

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "AllocationEventType" AS ENUM ('RESERVED', 'RESERVATION_EXPIRED', 'RESERVATION_CANCELLED', 'CONVERTED_TO_SALE', 'SALE_CANCELLED', 'TRANSFERRED', 'SWAPPED', 'RESOLD');

-- AlterTable: additive columns on "unit_sale_allocations" only
ALTER TABLE "unit_sale_allocations"
  ADD COLUMN "isCancelled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledReason" TEXT,
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "transferredFromAllocationId" TEXT;

CREATE UNIQUE INDEX "unit_sale_allocations_transferredFromAllocationId_key" ON "unit_sale_allocations"("transferredFromAllocationId");

-- CreateTable
CREATE TABLE "unit_reservations" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reservationFee" DECIMAL(18,2),
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancelledReason" TEXT,
    "cancelledById" TEXT,
    "isResale" BOOLEAN NOT NULL DEFAULT false,
    "convertedAllocationId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_reservations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "unit_reservations_convertedAllocationId_key" ON "unit_reservations"("convertedAllocationId");
CREATE INDEX "unit_reservations_unitId_status_idx" ON "unit_reservations"("unitId", "status");
CREATE INDEX "unit_reservations_status_expiresAt_idx" ON "unit_reservations"("status", "expiresAt");

-- CreateTable
CREATE TABLE "unit_allocation_events" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "allocationId" TEXT,
    "reservationId" TEXT,
    "eventType" "AllocationEventType" NOT NULL,
    "fromCustomerId" TEXT,
    "toCustomerId" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_allocation_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "unit_allocation_events_unitId_createdAt_idx" ON "unit_allocation_events"("unitId", "createdAt");
CREATE INDEX "unit_allocation_events_allocationId_idx" ON "unit_allocation_events"("allocationId");

-- AddForeignKey
ALTER TABLE "unit_sale_allocations" ADD CONSTRAINT "unit_sale_allocations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_sale_allocations" ADD CONSTRAINT "unit_sale_allocations_transferredFromAllocationId_fkey" FOREIGN KEY ("transferredFromAllocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unit_reservations" ADD CONSTRAINT "unit_reservations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_reservations" ADD CONSTRAINT "unit_reservations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_reservations" ADD CONSTRAINT "unit_reservations_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_reservations" ADD CONSTRAINT "unit_reservations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_reservations" ADD CONSTRAINT "unit_reservations_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_reservations" ADD CONSTRAINT "unit_reservations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_reservations" ADD CONSTRAINT "unit_reservations_convertedAllocationId_fkey" FOREIGN KEY ("convertedAllocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "unit_allocation_events" ADD CONSTRAINT "unit_allocation_events_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_allocation_events" ADD CONSTRAINT "unit_allocation_events_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "unit_sale_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_allocation_events" ADD CONSTRAINT "unit_allocation_events_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "unit_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_allocation_events" ADD CONSTRAINT "unit_allocation_events_fromCustomerId_fkey" FOREIGN KEY ("fromCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_allocation_events" ADD CONSTRAINT "unit_allocation_events_toCustomerId_fkey" FOREIGN KEY ("toCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "unit_allocation_events" ADD CONSTRAINT "unit_allocation_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
