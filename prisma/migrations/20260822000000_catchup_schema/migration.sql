-- AlterEnum
ALTER TYPE "JournalSourceType" ADD VALUE 'INVENTORY';











-- AlterTable
ALTER TABLE "intercompany_transactions" ADD COLUMN     "connectionId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "intercompany_connections" (
    "id" TEXT NOT NULL,
    "initiatorEntityId" TEXT NOT NULL,
    "counterpartyEntityId" TEXT NOT NULL,
    "initiatorDueFromAccountId" TEXT NOT NULL,
    "initiatorDueToAccountId" TEXT NOT NULL,
    "counterpartyDueFromAccountId" TEXT NOT NULL,
    "counterpartyDueToAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intercompany_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "intercompany_connections_initiatorEntityId_idx" ON "intercompany_connections"("initiatorEntityId");

-- CreateIndex
CREATE INDEX "intercompany_connections_counterpartyEntityId_idx" ON "intercompany_connections"("counterpartyEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "intercompany_connections_initiatorEntityId_counterpartyEnti_key" ON "intercompany_connections"("initiatorEntityId", "counterpartyEntityId");

-- AddForeignKey
ALTER TABLE "intercompany_connections" ADD CONSTRAINT "intercompany_connections_initiatorEntityId_fkey" FOREIGN KEY ("initiatorEntityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_connections" ADD CONSTRAINT "intercompany_connections_counterpartyEntityId_fkey" FOREIGN KEY ("counterpartyEntityId") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_connections" ADD CONSTRAINT "intercompany_connections_initiatorDueFromAccountId_fkey" FOREIGN KEY ("initiatorDueFromAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_connections" ADD CONSTRAINT "intercompany_connections_initiatorDueToAccountId_fkey" FOREIGN KEY ("initiatorDueToAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_connections" ADD CONSTRAINT "intercompany_connections_counterpartyDueFromAccountId_fkey" FOREIGN KEY ("counterpartyDueFromAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_connections" ADD CONSTRAINT "intercompany_connections_counterpartyDueToAccountId_fkey" FOREIGN KEY ("counterpartyDueToAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intercompany_transactions" ADD CONSTRAINT "intercompany_transactions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "intercompany_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

