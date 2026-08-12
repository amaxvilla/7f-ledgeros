-- Release IG.1, Checkpoint M: Microsoft To Do sync for HSE corrective
-- actions — additive. Three new nullable columns on corrective_actions,
-- no other table touched.

ALTER TABLE "corrective_actions" ADD COLUMN "taskProviderCode" TEXT;
ALTER TABLE "corrective_actions" ADD COLUMN "providerTaskId" TEXT;
ALTER TABLE "corrective_actions" ADD COLUMN "taskSyncFailedAt" TIMESTAMP(3);
