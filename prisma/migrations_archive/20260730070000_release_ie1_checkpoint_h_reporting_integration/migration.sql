-- Release IE.1, Checkpoint H: Payment Framework Reporting Integration.
-- Creates 1 read-only view over existing tables; no ALTER TABLE, no
-- new tables. See sql/views/vw_payment_transactions_register.sql for
-- the source-of-truth definition.

-- vw_payment_transactions_register
-- Release IE.1, Checkpoint H — Payment Framework Reporting Integration.
-- One row per PaymentTransaction, with refunds aggregated into
-- total_refunded / net_amount, so a caller doesn't have to join
-- payment_refunds separately to see the actual retained amount. Amounts
-- stay in minor units (kobo/cents) — same convention
-- PaymentTransaction.amount already uses; this view does not convert to
-- major units, that's a presentation-layer concern.
--
-- Mirrors the Dashboard/Reporting split already established elsewhere
-- (e.g. vw_fixed_asset_register vs. FixedAssetsService.getFixedAssetSummary):
-- PaymentsService.getOverview (Checkpoint G) is the lightweight
-- dashboard aggregate; this view is the statutory-grade, per-transaction
-- detail sitting alongside it, not replacing it.

CREATE OR REPLACE VIEW vw_payment_transactions_register AS
SELECT
  pt."id"                AS payment_transaction_id,
  pt."entityId"           AS entity_id,
  pt."reference"           AS reference,
  pt."providerCode"        AS provider_code,
  pt."amount"              AS amount,
  pt."currency"            AS currency,
  pt."status"              AS status,
  pt."customerEmail"       AS customer_email,
  pt."description"         AS description,
  pt."providerReference"   AS provider_reference,
  pt."paidAt"              AS paid_at,
  pt."createdAt"           AS created_at,
  COALESCE(refunds.total_refunded, 0) AS total_refunded,
  pt."amount" - COALESCE(refunds.total_refunded, 0) AS net_amount
FROM "payment_transactions" pt
LEFT JOIN (
  SELECT "paymentTransactionId", SUM("amount") AS total_refunded
  FROM "payment_refunds"
  WHERE "status" = 'SUCCESSFUL'
  GROUP BY "paymentTransactionId"
) refunds ON refunds."paymentTransactionId" = pt."id";
