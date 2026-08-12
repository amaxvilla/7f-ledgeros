-- Release IF.1, Checkpoint H — Mono scheduled statement sync watermark.
-- Additive only: one new nullable column on mono_linked_accounts. No
-- other table touched.

-- AlterTable
ALTER TABLE "mono_linked_accounts" ADD COLUMN "lastSyncedAt" TIMESTAMP(3);
