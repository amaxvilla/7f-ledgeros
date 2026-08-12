-- Release L — Output VAT on AR Invoices (additive). Adds 3 nullable
-- columns to ar_invoice_lines only. No existing column is altered or
-- dropped; every existing row gets NULL in all three new columns,
-- which the application layer already treats as "no VAT on this line".

-- AlterTable
ALTER TABLE "ar_invoice_lines" ADD COLUMN "vatRate" DECIMAL(6,4);
ALTER TABLE "ar_invoice_lines" ADD COLUMN "vatAmount" DECIMAL(18,2);
ALTER TABLE "ar_invoice_lines" ADD COLUMN "vatAuthorityAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "ar_invoice_lines" ADD CONSTRAINT "ar_invoice_lines_vatAuthorityAccountId_fkey" FOREIGN KEY ("vatAuthorityAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
