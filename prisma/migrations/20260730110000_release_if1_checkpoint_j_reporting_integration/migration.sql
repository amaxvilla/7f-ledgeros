-- Release IF.1, Checkpoint J: Bank Integration Framework Reporting
-- Integration. Creates 1 read-only view over existing tables; no ALTER
-- TABLE, no new tables. See sql/views/vw_mono_linked_accounts_register.sql
-- for the source-of-truth definition.

-- vw_mono_linked_accounts_register
-- Release IF.1, Checkpoint J — Bank Integration Framework Reporting
-- Integration. One row per MonoLinkedAccount, joined to bank_accounts
-- for entity_id (MonoLinkedAccount has no entityId column of its own).
-- Mirrors the Dashboard/Reporting split already established for Payment
-- Framework (vw_payment_transactions_register vs. PaymentsService.getOverview):
-- MonoLinkedAccountService.getOverview (Checkpoint I) is the lightweight
-- dashboard aggregate; this view is the statutory-grade, per-account
-- detail sitting alongside it, not replacing it.

CREATE OR REPLACE VIEW vw_mono_linked_accounts_register AS
SELECT
  mla."id"                  AS mono_linked_account_id,
  ba."entityId"              AS entity_id,
  mla."bankAccountId"        AS bank_account_id,
  mla."monoAccountId"        AS mono_account_id,
  mla."institutionName"      AS institution_name,
  mla."accountNumberMasked"  AS account_number_masked,
  mla."currency"             AS currency,
  mla."status"               AS status,
  mla."linkedAt"             AS linked_at,
  mla."revokedAt"            AS revoked_at,
  mla."reauthRequiredAt"     AS reauth_required_at,
  mla."lastSyncedAt"         AS last_synced_at
FROM "mono_linked_accounts" mla
JOIN "bank_accounts" ba ON ba."id" = mla."bankAccountId";
