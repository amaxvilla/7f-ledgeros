-- Release H: PMO Scheduling Core (WBS, dependencies, critical path,
-- earned value). Purely additive: no existing table is altered. Assumes
-- "projects" and "users" already exist.

-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskDependencyType" AS ENUM ('FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH');

-- CreateTable
CREATE TABLE "project_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "plannedStart" TIMESTAMP(3) NOT NULL,
    "plannedEnd" TIMESTAMP(3) NOT NULL,
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "percentComplete" INTEGER NOT NULL DEFAULT 0,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "budgetedCost" DECIMAL(18,2),
    "actualCost" DECIMAL(18,2),
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "totalFloatDays" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_tasks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_tasks_projectId_status_idx" ON "project_tasks"("projectId", "status");
CREATE INDEX "project_tasks_parentTaskId_idx" ON "project_tasks"("parentTaskId");
CREATE INDEX "project_tasks_entityId_idx" ON "project_tasks"("entityId");

-- CreateTable
CREATE TABLE "task_dependencies" (
    "id" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "type" "TaskDependencyType" NOT NULL DEFAULT 'FINISH_TO_START',
    "lagDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "task_dependencies_predecessorId_successorId_key" ON "task_dependencies"("predecessorId", "successorId");

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
