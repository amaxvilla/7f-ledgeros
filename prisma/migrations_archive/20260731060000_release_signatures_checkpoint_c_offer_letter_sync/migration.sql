-- Digital Signature Providers, Checkpoint C: Offer letter e-signature —
-- the first real caller of SignatureProvider. Three new nullable
-- columns on the existing "offers" table, no other table touched.
-- Mirrors the interviews/candidates tables' own sync-tracking columns.

ALTER TABLE "offers" ADD COLUMN "signatureProviderCode" TEXT;
ALTER TABLE "offers" ADD COLUMN "signatureProviderEnvelopeId" TEXT;
ALTER TABLE "offers" ADD COLUMN "signatureSyncFailedAt" TIMESTAMP(3);
