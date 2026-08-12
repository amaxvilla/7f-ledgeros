-- Release IG.1, Checkpoint D: calendar-sync failure visibility — additive.
-- One new nullable column on the existing "interviews" table, no other
-- table touched.

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN "calendarSyncFailedAt" TIMESTAMP(3);
