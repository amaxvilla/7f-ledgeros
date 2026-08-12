-- Release IG.1, Checkpoint T: Teams-sync failure visibility — additive.
-- One new nullable column on the existing "interviews" table, no other
-- table touched. Mirrors Checkpoint D's own calendarSyncFailedAt column
-- for the Teams-meeting sync Checkpoint S added.

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN "teamsSyncFailedAt" TIMESTAMP(3);
