-- vw_trial_balance
-- Phase 3A — statutory, period-aware Trial Balance.
--
-- This is deliberately a separate view from vw_consolidated_trial_balance
-- (Phase 2), not a replacement or a duplicate:
--   - vw_consolidated_trial_balance sums POSTED lines all-time, per entity,
--     for rolling a child entity's all-time balance into a parent. No
--     period dimension.
--   - vw_trial_balance is period-scoped and carries opening / period-movement
--     / closing balances per account per fiscal period, which is what a
--     statutory trial balance and every downstream statement (Balance
--     Sheet, P&L, Notes) actually need. It also reuses
--     GeneralLedgerQueryService.getTrialBalance's sign convention
--     (debit-normal for ASSET/EXPENSE, credit-normal otherwise) so figures
--     agree with the existing operational GL trial-balance endpoint.
--
-- Grain: one row per (entity, fiscal period, account).
-- Only POSTED journal entries are included — DRAFT/PENDING_APPROVAL/
-- APPROVED/REJECTED entries have no GL impact and REVERSED entries are
-- offset by their system-generated reversal entry, also POSTED.

CREATE OR REPLACE VIEW vw_trial_balance AS
WITH period_movement AS (
  SELECT
    fp."entityId"        AS entity_id,
    fp."id"               AS fiscal_period_id,
    fp."name"             AS period_name,
    fp."startDate"        AS period_start,
    fp."endDate"          AS period_end,
    a."id"                AS account_id,
    a."code"              AS account_code,
    a."name"              AS account_name,
    a."accountType"       AS account_type,
    a."accountCategory"   AS account_category,
    a."ifrsMapping"       AS ifrs_mapping,
    COALESCE(SUM(jl."debit"), 0)  AS period_debit,
    COALESCE(SUM(jl."credit"), 0) AS period_credit,
    CASE WHEN a."accountType" IN ('ASSET', 'EXPENSE')
         THEN COALESCE(SUM(jl."debit"), 0) - COALESCE(SUM(jl."credit"), 0)
         ELSE COALESCE(SUM(jl."credit"), 0) - COALESCE(SUM(jl."debit"), 0)
    END AS period_net_movement
  FROM "fiscal_periods" fp
  CROSS JOIN "accounts" a
  LEFT JOIN "journal_lines" jl
    ON jl."accountId" = a."id"
   AND jl."entityId" = fp."entityId"
  LEFT JOIN "journal_entries" je
    ON je."id" = jl."journalEntryId"
   AND je."status" = 'POSTED'
   AND je."fiscalPeriodId" = fp."id"
  WHERE a."isPostable" = true
  GROUP BY fp."entityId", fp."id", fp."name", fp."startDate", fp."endDate",
           a."id", a."code", a."name", a."accountType", a."accountCategory", a."ifrsMapping"
)
SELECT
  entity_id,
  fiscal_period_id,
  period_name,
  period_start,
  period_end,
  account_id,
  account_code,
  account_name,
  account_type,
  account_category,
  ifrs_mapping,
  COALESCE(SUM(period_net_movement) OVER (
    PARTITION BY entity_id, account_id
    ORDER BY period_start
    ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
  ), 0) AS opening_balance,
  period_debit,
  period_credit,
  period_net_movement,
  COALESCE(SUM(period_net_movement) OVER (
    PARTITION BY entity_id, account_id
    ORDER BY period_start
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ), 0) AS closing_balance
FROM period_movement;
-- vw_general_ledger
-- Phase 3A — line-level General Ledger report: every POSTED journal line,
-- with a running balance per entity/account ordered by entry date, journal
-- number, and line number. This is the drill-down that sits underneath
-- vw_trial_balance — a trial-balance row's closing_balance for
-- (entity, account, period) should equal the last running_balance row
-- returned from this view for that same (entity, account) within the
-- period's date range.
--
-- Grain: one row per journal line on a POSTED journal entry.

CREATE OR REPLACE VIEW vw_general_ledger AS
SELECT
  jl."id"              AS journal_line_id,
  je."id"               AS journal_entry_id,
  je."journalNumber"    AS journal_number,
  je."entryDate"        AS entry_date,
  je."fiscalPeriodId"   AS fiscal_period_id,
  je."description"      AS entry_description,
  je."sourceType"       AS source_type,
  je."sourceReference"  AS source_reference,
  jl."entityId"         AS entity_id,
  jl."accountId"        AS account_id,
  a."code"               AS account_code,
  a."name"               AS account_name,
  a."accountType"        AS account_type,
  a."accountCategory"    AS account_category,
  jl."lineNumber"       AS line_number,
  jl."memo"             AS memo,
  jl."debit"            AS debit,
  jl."credit"           AS credit,
  jl."projectId"        AS project_id,
  jl."departmentId"     AS department_id,
  jl."costCenterId"     AS cost_center_id,
  jl."fundingSourceId"  AS funding_source_id,
  jl."vendorId"         AS vendor_id,
  jl."customerId"       AS customer_id,
  jl."unitId"           AS unit_id,
  SUM(
    CASE WHEN a."accountType" IN ('ASSET', 'EXPENSE')
         THEN jl."debit" - jl."credit"
         ELSE jl."credit" - jl."debit"
    END
  ) OVER (
    PARTITION BY jl."entityId", jl."accountId"
    ORDER BY je."entryDate", je."journalNumber", jl."lineNumber"
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_balance
FROM "journal_lines" jl
JOIN "journal_entries" je ON je."id" = jl."journalEntryId"
JOIN "accounts" a ON a."id" = jl."accountId"
WHERE je."status" = 'POSTED';
