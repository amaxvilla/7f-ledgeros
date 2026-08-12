-- Release ID.2 Part 1: WhatsApp Cloud API — outbound sending + health
-- check. Additive only. Incoming-message handling and the Meta webhook
-- (signature verification + verification handshake) are deferred to
-- Part 2, same "outbound first, webhook second" split Release ID used
-- for SMS/Twilio.

-- NotificationChannel.WHATSAPP: must be added before any DML can
-- reference it (NotificationProcessor's new WhatsApp branch, this
-- migration itself does not use the value).
-- 'WHATSAPP' already present on "NotificationChannel" in the foundational
-- baseline migration; ADD VALUE removed here as redundant.

-- No new columns needed: WhatsApp reuses Notification.providerMessageId /
-- .deliveredAt (added in Release ID for SMS) exactly the same way SMS
-- does — see WhatsAppProcessor's doc comment.
