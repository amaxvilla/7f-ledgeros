-- Phase 3C: IFRS Notes to the Financial Statements — narrative disclosures.
--
-- Eighteen of the twenty-five requested notes are derived entirely from
-- existing views (vw_statement_of_financial_position,
-- vw_statement_profit_loss — both already at account grain with
-- ifrs_mapping, per their own header comments describing them as the
-- intended notes drill-down) via ReportingService, so they need no schema
-- changes at all. The remaining seven ("Reporting Entity Information",
-- "Basis of Preparation", "Significant Accounting Policies", "Related
-- Party Transactions", "Commitments", "Contingent Liabilities",
-- "Subsequent Events") are not derivable from journal postings by
-- definition and need a place for preparers to enter them — that's what
-- this migration adds.

CREATE TYPE "IfrsNarrativeNoteType" AS ENUM (
  'REPORTING_ENTITY_INFORMATION',
  'BASIS_OF_PREPARATION',
  'SIGNIFICANT_ACCOUNTING_POLICIES',
  'RELATED_PARTY_TRANSACTIONS',
  'COMMITMENTS',
  'CONTINGENT_LIABILITIES',
  'SUBSEQUENT_EVENTS'
);

CREATE TABLE "ifrs_note_disclosures" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fiscalPeriodId" TEXT NOT NULL,
    "noteType" "IfrsNarrativeNoteType" NOT NULL,
    "content" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ifrs_note_disclosures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ifrs_note_disclosures_entityId_fiscalPeriodId_noteType_key" ON "ifrs_note_disclosures"("entityId", "fiscalPeriodId", "noteType");
CREATE INDEX "ifrs_note_disclosures_entityId_fiscalPeriodId_idx" ON "ifrs_note_disclosures"("entityId", "fiscalPeriodId");

ALTER TABLE "ifrs_note_disclosures" ADD CONSTRAINT "ifrs_note_disclosures_entityId_fkey"
    FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ifrs_note_disclosures" ADD CONSTRAINT "ifrs_note_disclosures_fiscalPeriodId_fkey"
    FOREIGN KEY ("fiscalPeriodId") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ifrs_note_disclosures" ADD CONSTRAINT "ifrs_note_disclosures_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
