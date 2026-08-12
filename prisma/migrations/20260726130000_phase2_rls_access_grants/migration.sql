-- Phase 2: Row Level Security — additive access-grant tables.
-- Mirrors the existing user_entity_access table for Department, CostCenter,
-- and Project dimensions. No existing tables are altered or dropped.

CREATE TABLE "user_department_access" (
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "canPost" BOOLEAN NOT NULL DEFAULT false,
    "canView" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_department_access_pkey" PRIMARY KEY ("userId", "departmentId")
);

CREATE TABLE "user_cost_center_access" (
    "userId" TEXT NOT NULL,
    "costCenterId" TEXT NOT NULL,
    "canPost" BOOLEAN NOT NULL DEFAULT false,
    "canView" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_cost_center_access_pkey" PRIMARY KEY ("userId", "costCenterId")
);

CREATE TABLE "user_project_access" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "canPost" BOOLEAN NOT NULL DEFAULT false,
    "canView" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_project_access_pkey" PRIMARY KEY ("userId", "projectId")
);

CREATE INDEX "user_department_access_departmentId_idx" ON "user_department_access"("departmentId");
CREATE INDEX "user_cost_center_access_costCenterId_idx" ON "user_cost_center_access"("costCenterId");
CREATE INDEX "user_project_access_projectId_idx" ON "user_project_access"("projectId");

ALTER TABLE "user_department_access" ADD CONSTRAINT "user_department_access_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_department_access" ADD CONSTRAINT "user_department_access_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_cost_center_access" ADD CONSTRAINT "user_cost_center_access_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_cost_center_access" ADD CONSTRAINT "user_cost_center_access_costCenterId_fkey"
    FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_project_access" ADD CONSTRAINT "user_project_access_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_project_access" ADD CONSTRAINT "user_project_access_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
