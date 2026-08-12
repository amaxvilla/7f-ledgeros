-- Phase 5A: CRM / Lead Management / Prospects — pre-sale pipeline that
-- feeds into the existing (Phase 4) UnitReservation / UnitSaleAllocation
-- flow. Purely additive: no existing table is altered.
--
-- KNOWN RISK (inherited, not fixed — see prior land-bank / estate master
-- planning migration notes): this repo's migration history still has no
-- baseline migration for its pre-existing tables; this migration assumes
-- "entities", "projects", "estates", "units", "users", and "customers"
-- already exist.

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WALK_IN', 'REFERRAL', 'WEBSITE', 'SOCIAL_MEDIA', 'PROPERTY_PORTAL', 'AGENT', 'EVENT', 'COLD_CALL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('ACTIVE', 'SITE_VISIT_SCHEDULED', 'SITE_VISIT_DONE', 'NEGOTIATING', 'RESERVED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "CrmActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'SITE_VISIT', 'WHATSAPP', 'SMS', 'NOTE', 'FOLLOW_UP');

-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "estateId" TEXT,
    "budgetMin" DECIMAL(18,2),
    "budgetMax" DECIMAL(18,2),
    "notes" TEXT,
    "assignedToId" TEXT,
    "disqualifiedReason" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_leads_entityId_status_idx" ON "crm_leads"("entityId", "status");
CREATE INDEX "crm_leads_assignedToId_idx" ON "crm_leads"("assignedToId");

-- CreateTable
CREATE TABLE "crm_prospects" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "entityId" TEXT NOT NULL,
    "projectId" TEXT,
    "estateId" TEXT,
    "unitOfInterestId" TEXT,
    "status" "ProspectStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedToId" TEXT,
    "budgetMin" DECIMAL(18,2),
    "budgetMax" DECIMAL(18,2),
    "expectedCloseDate" TIMESTAMP(3),
    "lostReason" TEXT,
    "wonAt" TIMESTAMP(3),
    "convertedCustomerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_prospects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "crm_prospects_leadId_key" ON "crm_prospects"("leadId");
CREATE UNIQUE INDEX "crm_prospects_convertedCustomerId_key" ON "crm_prospects"("convertedCustomerId");
CREATE INDEX "crm_prospects_entityId_status_idx" ON "crm_prospects"("entityId", "status");
CREATE INDEX "crm_prospects_assignedToId_idx" ON "crm_prospects"("assignedToId");

-- CreateTable
CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "prospectId" TEXT,
    "activityType" "CrmActivityType" NOT NULL,
    "notes" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followUpAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "crm_activities_leadId_idx" ON "crm_activities"("leadId");
CREATE INDEX "crm_activities_prospectId_idx" ON "crm_activities"("prospectId");
CREATE INDEX "crm_activities_followUpAt_idx" ON "crm_activities"("followUpAt");

-- AddForeignKey
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "estates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_estateId_fkey" FOREIGN KEY ("estateId") REFERENCES "estates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_unitOfInterestId_fkey" FOREIGN KEY ("unitOfInterestId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_prospects" ADD CONSTRAINT "crm_prospects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "crm_prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
