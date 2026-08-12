-- Release IH, Checkpoint I: Employee <-> WorkspaceAdminProvider directory-
-- account sync — additive. Three new nullable columns on the existing
-- "employees" table, no other table touched. All null until the first
-- successful WorkspaceAdminProvider.createUser() call (best-effort sync,
-- mirroring the interviews.calendarProviderCode/calendarEventId/
-- calendarSyncFailedAt trio from Checkpoints IG.1.C/D and the
-- candidates.contactProviderCode/providerContactId/contactSyncFailedAt
-- trio from Checkpoint IG.1.G).

-- AlterTable
ALTER TABLE "employees" ADD COLUMN "directoryProviderCode" TEXT,
ADD COLUMN "directoryUserId" TEXT,
ADD COLUMN "directorySyncFailedAt" TIMESTAMP(3);
