-- vw_statement_of_financial_position
-- Phase 3A — IFRS Statement of Financial Position (Balance Sheet).
--
-- Built ON TOP OF vw_trial_balance (not a re-derivation from journal_lines)
-- so the two never disagree: this view is exactly vw_trial_balance's
-- ASSET/LIABILITY/EQUITY rows, tagged with the statutory section each
-- account_category rolls into. closing_balance is the right figure here
-- (a balance sheet is a point-in-time snapshot, so the cumulative balance
-- carried by vw_trial_balance is what's wanted — unlike the P&L view,
-- which needs the period-only movement).
--
-- Grain: one row per (entity, fiscal period, account) — same as
-- vw_trial_balance, filtered to balance-sheet account types. The
-- consuming service groups these into section subtotals (Current Assets,
-- Non-Current Assets, Current Liabilities, Non-Current Liabilities,
-- Equity) and computes totals; this view intentionally stays at
-- account-level grain so it also serves as the Notes-to-Financial-
-- Statements drill-down for any balance-sheet line.

CREATE OR REPLACE VIEW vw_statement_of_financial_position AS
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
  CASE account_category
    WHEN 'CURRENT_ASSET'      THEN 'ASSETS_CURRENT'
    WHEN 'NON_CURRENT_ASSET'  THEN 'ASSETS_NON_CURRENT'
    WHEN 'CURRENT_LIABILITY'     THEN 'LIABILITIES_CURRENT'
    WHEN 'NON_CURRENT_LIABILITY' THEN 'LIABILITIES_NON_CURRENT'
    WHEN 'SHARE_CAPITAL'      THEN 'EQUITY'
    WHEN 'RETAINED_EARNINGS'  THEN 'EQUITY'
    WHEN 'OTHER_EQUITY'       THEN 'EQUITY'
    ELSE 'UNCLASSIFIED'
  END AS statement_section,
  opening_balance,
  period_debit,
  period_credit,
  period_net_movement,
  closing_balance
FROM vw_trial_balance
WHERE account_type IN ('ASSET', 'LIABILITY', 'EQUITY');
-- vw_statement_profit_loss
-- Phase 3A — IFRS Statement of Profit or Loss.
--
-- Built on top of vw_trial_balance, same reasoning as
-- vw_statement_of_financial_position. The key difference: a P&L is a
-- flow over one period, not a point-in-time balance, so this view
-- exposes period_net_movement as `amount` rather than closing_balance.
-- This repo has no year-end close/rollforward journal that zeroes
-- REVENUE/EXPENSE accounts back to Retained Earnings, so vw_trial_balance's
-- closing_balance for a P&L account is a cumulative-since-inception figure
-- and NOT what a statutory P&L for a single period should show — only
-- period_net_movement is period-scoped and safe to use here.
--
-- Grain: one row per (entity, fiscal period, account), filtered to
-- REVENUE/EXPENSE account types, tagged with the statutory section each
-- account_category rolls into (Revenue, Cost of Sales, Operating
-- Expense, Finance Expense, Tax Expense).

CREATE OR REPLACE VIEW vw_statement_profit_loss AS
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
  CASE account_category
    WHEN 'OPERATING_REVENUE'  THEN 'REVENUE'
    WHEN 'OTHER_REVENUE'      THEN 'REVENUE'
    WHEN 'COST_OF_SALES'      THEN 'COST_OF_SALES'
    WHEN 'OPERATING_EXPENSE'  THEN 'OPERATING_EXPENSE'
    WHEN 'FINANCE_EXPENSE'    THEN 'FINANCE_EXPENSE'
    WHEN 'TAX_EXPENSE'        THEN 'TAX_EXPENSE'
    ELSE 'UNCLASSIFIED'
  END AS statement_section,
  period_net_movement AS amount
FROM vw_trial_balance
WHERE account_type IN ('REVENUE', 'EXPENSE');
