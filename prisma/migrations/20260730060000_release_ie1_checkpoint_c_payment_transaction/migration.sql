-- Release IE.1, Checkpoint C: Payment Transaction model. Purely
-- additive: no existing table is altered. Assumes "entities" and
-- "users" already exist. No worker/queue/webhook/controller wiring in
-- this migration — those are separate checkpoints.

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED');

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "customerEmail" TEXT NOT NULL,
    "description" TEXT,
    "authorizationUrl" TEXT,
    "providerReference" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "rawVerification" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_transactions_reference_key" ON "payment_transactions"("reference");
CREATE INDEX "payment_transactions_entityId_status_idx" ON "payment_transactions"("entityId", "status");
CREATE INDEX "payment_transactions_providerCode_idx" ON "payment_transactions"("providerCode");

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "refundReference" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "rawResponse" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_refunds_refundReference_key" ON "payment_refunds"("refundReference");
CREATE INDEX "payment_refunds_paymentTransactionId_idx" ON "payment_refunds"("paymentTransactionId");

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "payment_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
