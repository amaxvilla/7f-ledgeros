-- Agent & Commission Management, RE-COMM.4: Financial Integration.
-- Additive: no existing column/table dropped or altered in place.
-- Assumes "commission_calculations", "accounts", and "journal_entries"
-- already exist.

ALTER TABLE "commission_calculations" ADD COLUMN "payableAccountId" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "payableJournalEntryId" TEXT;
ALTER TABLE "commission_calculations" ADD COLUMN "paymentJournalEntryId" TEXT;

-- AddForeignKey
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_payableAccountId_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_payableJournalEntryId_fkey" FOREIGN KEY ("payableJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commission_calculations" ADD CONSTRAINT "commission_calculations_paymentJournalEntryId_fkey" FOREIGN KEY ("paymentJournalEntryId") REFERENCES "journal_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
