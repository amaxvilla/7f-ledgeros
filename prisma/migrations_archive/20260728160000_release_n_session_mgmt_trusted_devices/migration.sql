-- Release N: Session Management, Session Revocation & Trusted Devices —
-- additive. Extends the existing refresh_tokens table with session
-- metadata (each row already IS a session) and adds one new table,
-- trusted_devices, for "remember this device" MFA bypass. No existing
-- column is altered or dropped.

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "deviceId" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "lastUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "trustedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trusted_devices_userId_idx" ON "trusted_devices"("userId");

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "trusted_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "refresh_tokens_deviceId_idx" ON "refresh_tokens"("deviceId");
