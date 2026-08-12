-- Phase 2: Row Level Security — Business Unit dimension (additive).
-- Adds a new grouping above Entity plus its access-grant table. No
-- existing tables are altered destructively; entities.businessUnitId is
-- nullable, so every existing row remains valid with no backfill required.

CREATE TABLE "business_units" (
    "id"        TEXT NOT NULL,
    "code"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "business_units_code_key" ON "business_units"("code");

CREATE TABLE "user_business_unit_access" (
    "userId"         TEXT NOT NULL,
    "businessUnitId" TEXT NOT NULL,
    "canPost"        BOOLEAN NOT NULL DEFAULT false,
    "canView"        BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_business_unit_access_pkey" PRIMARY KEY ("userId", "businessUnitId")
);

CREATE INDEX "user_business_unit_access_businessUnitId_idx" ON "user_business_unit_access"("businessUnitId");

ALTER TABLE "user_business_unit_access" ADD CONSTRAINT "user_business_unit_access_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_business_unit_access" ADD CONSTRAINT "user_business_unit_access_businessUnitId_fkey"
    FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nullable FK on the existing entities table — additive, no default needed,
-- existing rows simply have NULL (unassigned) until an admin assigns them.
ALTER TABLE "entities" ADD COLUMN "businessUnitId" TEXT;

CREATE INDEX "entities_businessUnitId_idx" ON "entities"("businessUnitId");

ALTER TABLE "entities" ADD CONSTRAINT "entities_businessUnitId_fkey"
    FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
