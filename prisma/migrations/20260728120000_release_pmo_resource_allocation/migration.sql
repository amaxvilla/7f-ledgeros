-- Release J: PMO Resource Planning + Equipment/Labour Allocation. Purely
-- additive: no existing table is altered. Assumes "projects", "entities",
-- "project_tasks", "users" already exist.

-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('LABOUR', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "ResourceAllocationStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "project_resources" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "unitOfMeasure" TEXT,
    "unitCost" DECIMAL(18,2),
    "capacity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_resources_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_resources_projectId_type_idx" ON "project_resources"("projectId", "type");
CREATE INDEX "project_resources_entityId_idx" ON "project_resources"("entityId");

-- CreateTable
CREATE TABLE "resource_allocations" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "plannedQuantity" DECIMAL(10,2) NOT NULL,
    "actualQuantity" DECIMAL(10,2),
    "status" "ResourceAllocationStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "cancelledReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_allocations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "resource_allocations_resourceId_status_idx" ON "resource_allocations"("resourceId", "status");
CREATE INDEX "resource_allocations_taskId_idx" ON "resource_allocations"("taskId");
CREATE INDEX "resource_allocations_entityId_idx" ON "resource_allocations"("entityId");

-- AddForeignKey
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_resources" ADD CONSTRAINT "project_resources_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "project_resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "resource_allocations" ADD CONSTRAINT "resource_allocations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
