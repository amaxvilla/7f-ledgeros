-- Release (Tax Center Core, additive). Adds a TaxCode reference-data
-- table only. Does NOT alter wht_deductions, vat_deductions, or any
-- Accounts Payable table — those keep taking an explicit rate/authority
-- per allocation, unchanged.

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('WHT', 'VAT');

-- CreateTable
CREATE TABLE "tax_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "jurisdiction" TEXT,
    "taxAuthorityAccountId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_codes_code_key" ON "tax_codes"("code");

-- AddForeignKey
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_taxAuthorityAccountId_fkey" FOREIGN KEY ("taxAuthorityAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
