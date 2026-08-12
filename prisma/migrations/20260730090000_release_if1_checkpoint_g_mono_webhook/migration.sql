-- Release IF.1, Checkpoint G — Mono webhook handling. Additive only:
-- one new enum value on MonoLinkStatus, one new nullable column on
-- mono_linked_accounts. No other table touched.

-- AlterEnum
ALTER TYPE "MonoLinkStatus" ADD VALUE 'REQUIRES_REAUTH';

-- AlterTable
ALTER TABLE "mono_linked_accounts" ADD COLUMN "reauthRequiredAt" TIMESTAMP(3);
