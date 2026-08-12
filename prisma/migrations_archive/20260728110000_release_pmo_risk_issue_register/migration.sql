-- Release I: PMO Risk & Issue Management. Purely additive: no existing
-- table is altered. Assumes "projects", "entities", "users" already exist.

-- CreateEnum
CREATE TYPE "RiskProbability" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskImpact" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('IDENTIFIED', 'ASSESSED', 'MITIGATING', 'MONITORING', 'OCCURRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED');

-- CreateTable
CREATE TABLE "project_risks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "probability" "RiskProbability" NOT NULL DEFAULT 'MEDIUM',
    "impact" "RiskImpact" NOT NULL DEFAULT 'MEDIUM',
    "riskScore" INTEGER NOT NULL,
    "status" "RiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "ownerId" TEXT,
    "mitigationPlan" TEXT,
    "identifiedById" TEXT NOT NULL,
    "identifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_risks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_risks_projectId_status_idx" ON "project_risks"("projectId", "status");
CREATE INDEX "project_risks_entityId_idx" ON "project_risks"("entityId");

-- CreateTable
CREATE TABLE "project_issues" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "riskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "raisedById" TEXT NOT NULL,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_issues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_issues_projectId_status_idx" ON "project_issues"("projectId", "status");
CREATE INDEX "project_issues_entityId_idx" ON "project_issues"("entityId");
CREATE INDEX "project_issues_riskId_idx" ON "project_issues"("riskId");

-- AddForeignKey
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_identifiedById_fkey" FOREIGN KEY ("identifiedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "project_risks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
