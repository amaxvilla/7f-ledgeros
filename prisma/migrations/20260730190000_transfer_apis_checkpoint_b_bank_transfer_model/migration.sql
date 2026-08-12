-- Transfer APIs, Checkpoint B: BankTransfer persistence with a
-- database-enforced idempotency guarantee (UNIQUE on "reference").
-- Additive: no existing table touched. Assumes "entities" and "users"
-- already exist.

-- CreateEnum
CREATE TYPE "BankTransferStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'REVERSED');

-- CreateTable
CREATE TABLE "bank_transfers" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "providerTransferId" TEXT,
    "reference" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "recipientAccountNumber" TEXT NOT NULL,
    "recipientBankCode" TEXT NOT NULL,
    "recipientName" TEXT,
    "narration" TEXT,
    "status" "BankTransferStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "workflowInstanceId" TEXT,
    "initiatedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transfers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bank_transfers_reference_key" ON "bank_transfers"("reference");
CREATE INDEX "bank_transfers_entityId_status_idx" ON "bank_transfers"("entityId", "status");
CREATE INDEX "bank_transfers_providerCode_idx" ON "bank_transfers"("providerCode");

-- AddForeignKey
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_transfers" ADD CONSTRAINT "bank_transfers_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
