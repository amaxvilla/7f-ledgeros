-- Digital Signature Providers, Checkpoint H: Generic Signature Provider —
-- new table only, no existing table touched. GenericSignatureProvider has
-- no external vendor to be the system of record for envelope state
-- (unlike DocuSign/Adobe Sign), so it is one itself.

-- CreateEnum
CREATE TYPE "ManualSignatureStatus" AS ENUM ('SENT', 'DELIVERED', 'COMPLETED', 'DECLINED', 'VOIDED');

-- CreateTable
CREATE TABLE "manual_signature_envelopes" (
    "id" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "documentContentType" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "signedDocumentKey" TEXT,
    "signersJson" JSONB NOT NULL,
    "subject" TEXT,
    "message" TEXT,
    "status" "ManualSignatureStatus" NOT NULL DEFAULT 'SENT',
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_signature_envelopes_pkey" PRIMARY KEY ("id")
);
