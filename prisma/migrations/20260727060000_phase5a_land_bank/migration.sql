-- Phase 5A: Land Bank — parcels, acquisitions, titles, survey plans,
-- and plots. Purely additive: five new tables, five new enums, one new
-- nullable back-reference on "entities" is implicit (no column change
-- needed there — the relation lives entirely on land_parcels.entityId).
--
-- KNOWN RISK (inherited, not fixed — see Phase 4 migration note): this
-- repo's migration history still has no baseline migration for its
-- pre-existing tables; every migration file including this one assumes
-- those tables already exist.

-- CreateEnum
CREATE TYPE "LandParcelStatus" AS ENUM ('AVAILABLE', 'UNDER_ACQUISITION', 'ACQUIRED', 'IN_TITLING', 'TITLED', 'SURVEYED', 'SUBDIVIDED', 'DEVELOPED', 'DISPOSED');
CREATE TYPE "LandAcquisitionStatus" AS ENUM ('NEGOTIATION', 'AGREED', 'PAYMENT_IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TitleType" AS ENUM ('CERTIFICATE_OF_OCCUPANCY', 'DEED_OF_ASSIGNMENT', 'GOVERNORS_CONSENT', 'GAZETTE', 'FREEHOLD', 'LEASEHOLD', 'OTHER');
CREATE TYPE "TitleStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PERFECTED', 'REJECTED', 'EXPIRED');
CREATE TYPE "SurveyPlanStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
CREATE TYPE "PlotStatus" AS ENUM ('PLANNED', 'AVAILABLE', 'RESERVED', 'ALLOCATED', 'SOLD');
CREATE TYPE "PlotUseType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'MIXED_USE', 'INDUSTRIAL', 'AGRICULTURAL');

-- CreateTable
CREATE TABLE "land_parcels" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "stateProvince" TEXT,
    "localGovernmentArea" TEXT,
    "areaSqm" DECIMAL(14,2) NOT NULL,
    "acquisitionCostBudget" DECIMAL(18,2),
    "status" "LandParcelStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "land_parcels_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "land_parcels_entityId_code_key" ON "land_parcels"("entityId", "code");

-- CreateTable
CREATE TABLE "land_acquisitions" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "vendorContact" TEXT,
    "agreedPrice" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentTerms" TEXT,
    "dueDiligenceNotes" TEXT,
    "status" "LandAcquisitionStatus" NOT NULL DEFAULT 'NEGOTIATION',
    "acquisitionDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "land_acquisitions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "land_acquisitions_parcelId_status_idx" ON "land_acquisitions"("parcelId", "status");

-- CreateTable
CREATE TABLE "title_deeds" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "titleType" "TitleType" NOT NULL,
    "titleNumber" TEXT,
    "status" "TitleStatus" NOT NULL DEFAULT 'PENDING',
    "issuingAuthority" TEXT,
    "applicationDate" TIMESTAMP(3),
    "issuedDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "documentRef" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "title_deeds_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "title_deeds_parcelId_status_idx" ON "title_deeds"("parcelId", "status");

-- CreateTable
CREATE TABLE "survey_plans" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "planNumber" TEXT NOT NULL,
    "surveyorName" TEXT,
    "surveyDate" TIMESTAMP(3),
    "areaSqm" DECIMAL(14,2),
    "coordinates" JSONB,
    "documentRef" TEXT,
    "status" "SurveyPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "survey_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "survey_plans_parcelId_planNumber_key" ON "survey_plans"("parcelId", "planNumber");

-- CreateTable
CREATE TABLE "plots" (
    "id" TEXT NOT NULL,
    "parcelId" TEXT NOT NULL,
    "surveyPlanId" TEXT,
    "plotNumber" TEXT NOT NULL,
    "areaSqm" DECIMAL(14,2) NOT NULL,
    "useType" "PlotUseType" NOT NULL DEFAULT 'RESIDENTIAL',
    "status" "PlotStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plots_parcelId_plotNumber_key" ON "plots"("parcelId", "plotNumber");

-- AddForeignKey
ALTER TABLE "land_parcels" ADD CONSTRAINT "land_parcels_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "land_acquisitions" ADD CONSTRAINT "land_acquisitions_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "land_parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "title_deeds" ADD CONSTRAINT "title_deeds_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "land_parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "survey_plans" ADD CONSTRAINT "survey_plans_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "land_parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plots" ADD CONSTRAINT "plots_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "land_parcels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "plots" ADD CONSTRAINT "plots_surveyPlanId_fkey" FOREIGN KEY ("surveyPlanId") REFERENCES "survey_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
