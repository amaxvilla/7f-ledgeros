-- Release M: MFA (TOTP), QR Enrollment, Recovery Codes. Additive: 3 new
-- nullable/defaulted columns on the existing "users" table (no backfill
-- needed) plus 1 new table. No ALTER on any other existing table.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "mfaEnrolledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "mfa_recovery_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "mfa_recovery_codes_userId_idx" ON "mfa_recovery_codes"("userId");

-- AddForeignKey
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
