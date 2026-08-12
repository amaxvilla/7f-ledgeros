-- Digital Signature Providers, Checkpoint J: manual decline — one new
-- nullable column on the existing "manual_signature_envelopes" table
-- (added in Checkpoint H), no other table touched. Separate from
-- voidReason (see the column's own schema.prisma comment for why).

ALTER TABLE "manual_signature_envelopes" ADD COLUMN "declineReason" TEXT;
