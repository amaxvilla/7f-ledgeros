-- Release IG.1, Checkpoint C: Interview <-> CalendarProvider sync — additive.
-- Two new nullable columns on the existing "interviews" table, no other
-- table touched. Both null until the first successful
-- CalendarProvider.createEvent() call (best-effort sync, see
-- InterviewService.schedule()'s own comment for why this must never be
-- required for the interview row itself to be created).

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN "calendarProviderCode" TEXT,
ADD COLUMN "calendarEventId" TEXT;
