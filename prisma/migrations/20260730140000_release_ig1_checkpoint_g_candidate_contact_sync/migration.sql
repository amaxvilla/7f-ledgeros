-- Release IG.1, Checkpoint G: Candidate <-> ContactsProvider sync — additive.
-- Three new nullable columns on the existing "candidates" table, no other
-- table touched. All null until the first successful
-- ContactsProvider.createContact() call (best-effort sync, mirroring the
-- interviews.calendarProviderCode/calendarEventId/calendarSyncFailedAt
-- trio added in Checkpoints C/D).

-- AlterTable
ALTER TABLE "candidates" ADD COLUMN "contactProviderCode" TEXT,
ADD COLUMN "providerContactId" TEXT,
ADD COLUMN "contactSyncFailedAt" TIMESTAMP(3);
