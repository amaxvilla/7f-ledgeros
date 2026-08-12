-- Release IG.1, Checkpoint S: Interview <-> TeamsProvider sync — additive.
-- Three new nullable columns on the existing "interviews" table, no other
-- table touched. All null unless the interview's location is exactly
-- "video-call" AND a TeamsProvider is registered AND the best-effort
-- createMeeting() call succeeds (see InterviewService.trySyncTeamsMeeting's
-- own comment for why this must never be required for the interview row
-- itself to be created).

-- AlterTable
ALTER TABLE "interviews" ADD COLUMN "teamsProviderCode" TEXT,
ADD COLUMN "teamsMeetingId" TEXT,
ADD COLUMN "teamsJoinUrl" TEXT;
