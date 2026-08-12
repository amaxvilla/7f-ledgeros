-- Agent Management, RE-AGENT.1: Agent Master. Additive: no existing
-- table touched. Assumes "entities" and "users" already exist.

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'BROKER');
CREATE TYPE "AgentStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "displayName" TEXT NOT NULL,
    "contactPersonName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "licenseNumber" TEXT,
    "licenseIssuingBody" TEXT,
    "licenseExpiryDate" TIMESTAMP(3),
    "registrationNumber" TEXT,
    "entityId" TEXT NOT NULL,
    "bankName" TEXT,
    "bankAccountName" TEXT,
    "bankAccountNumber" TEXT,
    "bankSwiftCode" TEXT,
    "taxIdentificationNumber" TEXT,
    "withholdingTaxExempt" BOOLEAN NOT NULL DEFAULT false,
    "agreementReference" TEXT,
    "agreementStartDate" TIMESTAMP(3),
    "agreementEndDate" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "suspendedById" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendReason" TEXT,
    "terminatedById" TEXT,
    "terminatedAt" TIMESTAMP(3),
    "terminateReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agents_code_key" ON "agents"("code");
CREATE INDEX "agents_entityId_idx" ON "agents"("entityId");
CREATE INDEX "agents_status_idx" ON "agents"("status");
CREATE INDEX "agents_agentType_idx" ON "agents"("agentType");

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_suspendedById_fkey" FOREIGN KEY ("suspendedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agents" ADD CONSTRAINT "agents_terminatedById_fkey" FOREIGN KEY ("terminatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
