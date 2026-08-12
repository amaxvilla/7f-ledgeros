-- Release K: Security Hardening Part 1 — Password Policy Engine, Login
-- History, Account Lockout. Additive: new tables plus three new nullable/
-- defaulted columns on the existing "users" table (no data loss, no
-- existing column touched).

-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "lockedUntil" TIMESTAMP(3);

-- CreateEnum
CREATE TYPE "LoginEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'ACCOUNT_LOCKED', 'ACCOUNT_UNLOCKED');

-- CreateTable
CREATE TABLE "auth_security_policies" (
    "id" TEXT NOT NULL,
    "entityId" TEXT,
    "minLength" INTEGER NOT NULL DEFAULT 8,
    "requireUppercase" BOOLEAN NOT NULL DEFAULT true,
    "requireLowercase" BOOLEAN NOT NULL DEFAULT true,
    "requireNumber" BOOLEAN NOT NULL DEFAULT true,
    "requireSymbol" BOOLEAN NOT NULL DEFAULT false,
    "expiryDays" INTEGER,
    "historyCount" INTEGER NOT NULL DEFAULT 5,
    "maxFailedLoginAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockoutDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_security_policies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "auth_security_policies_entityId_key" ON "auth_security_policies"("entityId");

-- CreateTable
CREATE TABLE "password_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "password_history_userId_idx" ON "password_history"("userId");

-- CreateTable
CREATE TABLE "login_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "emailAttempted" TEXT NOT NULL,
    "eventType" "LoginEventType" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "login_history_userId_idx" ON "login_history"("userId");
CREATE INDEX "login_history_emailAttempted_idx" ON "login_history"("emailAttempted");
CREATE INDEX "login_history_createdAt_idx" ON "login_history"("createdAt");

-- AddForeignKey
ALTER TABLE "auth_security_policies" ADD CONSTRAINT "auth_security_policies_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "auth_security_policies" ADD CONSTRAINT "auth_security_policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "password_history" ADD CONSTRAINT "password_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "login_history" ADD CONSTRAINT "login_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
