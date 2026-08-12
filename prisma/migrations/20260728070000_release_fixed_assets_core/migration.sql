-- Release (Fixed Assets Core, additive). Adds the fixed-asset register,
-- straight-line depreciation engine, and disposal accounting. No existing
-- table is altered or dropped. Assumes "entities", "accounts",
-- "departments", "cost_centers", "users", and "journal_entries" already
-- exist (see prior phase migrations).

-- AlterEnum
-- 'FIXED_ASSET' already present on "JournalSourceType" in the foundational
-- baseline migration (baseline_full.sql reflects the final schema); this
-- ADD VALUE is redundant against the clean baseline and was removed here.

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE');

-- CreateEnum
CREATE TYPE "DepreciationEntryStatus" AS ENUM ('PENDING', 'POSTED');

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultUsefulLifeYears" INTEGER NOT NULL,
    "defaultDepreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "assetAccountId" TEXT NOT NULL,
    "accumulatedDepreciationAccountId" TEXT NOT NULL,
    "depreciationExpenseAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "assetCategoryId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "acquisitionDate" TIMESTAMP(3) NOT NULL,
    "acquisitionCost" DECIMAL(18,2) NOT NULL,
    "residualValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "usefulLifeYears" INTEGER NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "departmentId" TEXT,
    "costCenterId" TEXT,
    "locationName" TEXT,
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastDepreciatedThrough" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_entries" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "depreciationAmount" DECIMAL(18,2) NOT NULL,
    "accumulatedDepreciation" DECIMAL(18,2) NOT NULL,
    "netBookValue" DECIMAL(18,2) NOT NULL,
    "status" "DepreciationEntryStatus" NOT NULL DEFAULT 'PENDING',
    "journalEntryId" TEXT,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_disposals" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "disposalDate" TIMESTAMP(3) NOT NULL,
    "disposalProceeds" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netBookValueAtDisposal" DECIMAL(18,2) NOT NULL,
    "gainLoss" DECIMAL(18,2) NOT NULL,
    "journalEntryId" TEXT,
    "disposedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_disposals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_name_key" ON "asset_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_assets_entityId_assetTag_key" ON "fixed_assets"("entityId", "assetTag");

-- CreateIndex
CREATE INDEX "fixed_assets_entityId_idx" ON "fixed_assets"("entityId");

-- CreateIndex
CREATE INDEX "fixed_assets_assetCategoryId_idx" ON "fixed_assets"("assetCategoryId");

-- CreateIndex
CREATE INDEX "fixed_assets_status_idx" ON "fixed_assets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "depreciation_entries_fixedAssetId_periodDate_key" ON "depreciation_entries"("fixedAssetId", "periodDate");

-- CreateIndex
CREATE INDEX "depreciation_entries_fixedAssetId_idx" ON "depreciation_entries"("fixedAssetId");

-- CreateIndex
CREATE INDEX "depreciation_entries_status_idx" ON "depreciation_entries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "asset_disposals_fixedAssetId_key" ON "asset_disposals"("fixedAssetId");

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_assetAccountId_fkey" FOREIGN KEY ("assetAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_accumulatedDepreciationAccountId_fkey" FOREIGN KEY ("accumulatedDepreciationAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_depreciationExpenseAccountId_fkey" FOREIGN KEY ("depreciationExpenseAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_assetCategoryId_fkey" FOREIGN KEY ("assetCategoryId") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "cost_centers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_entries" ADD CONSTRAINT "depreciation_entries_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "fixed_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_entries" ADD CONSTRAINT "depreciation_entries_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "fixed_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_disposals" ADD CONSTRAINT "asset_disposals_disposedById_fkey" FOREIGN KEY ("disposedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
