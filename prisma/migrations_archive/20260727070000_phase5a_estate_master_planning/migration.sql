-- Phase 5A: Estate Master Planning — versioned master plans + zones per
-- estate, and the Plot -> Project release that formally hands a Land
-- Bank plot off to the Real Estate build pipeline. Purely additive.
--
-- KNOWN RISK (inherited, not fixed — see prior land-bank migration note):
-- this repo's migration history still has no baseline migration for its
-- pre-existing tables; every migration file including this one assumes
-- those tables already exist, including "plots" and "projects" created
-- in earlier migrations of this same phase.

-- CreateEnum
CREATE TYPE "MasterPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "estate_master_plans" (
    "id" TEXT NOT NULL,
    "estateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "MasterPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "summary" TEXT,
    "totalPlannedUnits" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estate_master_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "estate_master_plans_estateId_version_key" ON "estate_master_plans"("estateId", "version");

-- CreateTable
CREATE TABLE "master_plan_zones" (
    "id" TEXT NOT NULL,
    "masterPlanId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "useType" "PlotUseType" NOT NULL,
    "plannedAreaSqm" DECIMAL(14,2),
    "plannedUnitCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_plan_zones_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "master_plan_zones_masterPlanId_code_key" ON "master_plan_zones"("masterPlanId", "code");

-- CreateTable
CREATE TABLE "plot_project_releases" (
    "id" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plot_project_releases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plot_project_releases_plotId_key" ON "plot_project_releases"("plotId");

-- AddForeignKey
ALTER TABLE "estate_master_plans" ADD CONSTRAINT "estate_master_plans_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "estates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_plan_zones" ADD CONSTRAINT "master_plan_zones_masterPlanId_fkey" FOREIGN KEY ("masterPlanId") REFERENCES "estate_master_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plot_project_releases" ADD CONSTRAINT "plot_project_releases_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "plots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plot_project_releases" ADD CONSTRAINT "plot_project_releases_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
