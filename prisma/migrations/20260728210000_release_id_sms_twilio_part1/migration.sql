-- Release ID Part 1: SMS Integration (Twilio) + Delivery Receipts.
-- Additive only — no existing column dropped or retyped, no existing
-- enum value removed. WhatsApp Cloud (also scoped to Release ID) is
-- deferred to Part 2 and adds nothing here.

-- User.phone: SMS needs a destination number. Nullable — existing users
-- are unaffected, SmsProcessor handles a null phone explicitly (see its
-- doc comment) rather than this migration needing a backfill.
ALTER TABLE "users" ADD COLUMN "phone" TEXT;

-- NotificationStatus.DELIVERED: must be added before it can be used by
-- any UPDATE — this migration only adds the value, no DML references it.
-- 'DELIVERED' already present on "NotificationStatus" in the foundational
-- baseline migration; ADD VALUE removed here as redundant.

-- Notification: correlates an outgoing SMS with Twilio's async
-- status-callback webhook, and records confirmed-delivered time.
ALTER TABLE "notifications" ADD COLUMN "providerMessageId" TEXT;
ALTER TABLE "notifications" ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE INDEX "notifications_providerMessageId_idx" ON "notifications"("providerMessageId");
