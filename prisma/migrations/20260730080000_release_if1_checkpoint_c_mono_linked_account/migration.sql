-- Release IF.1, Checkpoint C: Mono Connect account linking — additive.
-- One new enum, one new table, no changes to any existing table besides
-- new nullable-free back-relations (no column changes on bank_accounts/users).

-- CreateEnum
CREATE TYPE "MonoLinkStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "mono_linked_accounts" (
    "id" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "monoAccountId" TEXT NOT NULL,
    "institutionName" TEXT,
    "accountNumberMasked" TEXT,
    "currency" TEXT,
    "status" "MonoLinkStatus" NOT NULL DEFAULT 'ACTIVE',
    "linkedById" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mono_linked_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mono_linked_accounts_monoAccountId_key" ON "mono_linked_accounts"("monoAccountId");
CREATE INDEX "mono_linked_accounts_bankAccountId_idx" ON "mono_linked_accounts"("bankAccountId");
CREATE INDEX "mono_linked_accounts_status_idx" ON "mono_linked_accounts"("status");

-- AddForeignKey
ALTER TABLE "mono_linked_accounts" ADD CONSTRAINT "mono_linked_accounts_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mono_linked_accounts" ADD CONSTRAINT "mono_linked_accounts_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
