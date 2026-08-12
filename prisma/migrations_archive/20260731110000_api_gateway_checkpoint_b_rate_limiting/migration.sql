-- API Gateway, Checkpoint B: Rate Limiting — additive. One new nullable
-- column on api_keys; null means unlimited, so every existing key keeps
-- its current (unlimited) behavior after this migration.

ALTER TABLE "api_keys" ADD COLUMN "rateLimitPerMinute" INTEGER;
