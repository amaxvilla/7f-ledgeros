-- vw_statement_cash_flow
-- Phase 3A — IFRS Statement of Cash Flows (source data for both the
-- Indirect and Direct presentations; the split between them happens in
-- ReportingService, not here, since both methods must reconcile to the
-- exact same operating-activities total per IAS 7 and that arithmetic is
-- easier to keep provably consistent in one place).
--
-- Built on top of vw_trial_balance, tagging each account with the cash
-- flow section it belongs to. Reuses the same account_category values
-- as the other Phase 3A statements plus the same documented heuristic as
-- vw_financial_ratios for identifying cash/bank accounts within
-- CURRENT_ASSET (ifrs_mapping/account_name ILIKE '%cash%'/'%bank%') —
-- see that view's header comment for why this is a heuristic and not a
-- structural guarantee.
--
-- RETAINED_EARNINGS is tagged FINANCING, not left out: this ledger has no
-- year-end close journal sweeping REVENUE/EXPENSE into Retained Earnings
-- (see vw_statement_of_financial_position's header comment), so any
-- in-period movement on a RETAINED_EARNINGS account is a direct posting
-- (e.g. a dividend declared) rather than a P&L sweep, and belongs in
-- Financing Activities like any other equity-affecting transaction.
--
-- Grain: one row per (entity, fiscal period, account) — same as
-- vw_trial_balance.

CREATE OR REPLACE VIEW vw_statement_cash_flow AS
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
  CASE
    WHEN account_category = 'CURRENT_ASSET'
         AND (ifrs_mapping ILIKE '%cash%' OR ifrs_mapping ILIKE '%bank%'
              OR account_name ILIKE '%cash%' OR account_name ILIKE '%bank%')
      THEN 'CASH_AND_EQUIVALENTS'
    WHEN account_category IN ('CURRENT_ASSET', 'CURRENT_LIABILITY') THEN 'OPERATING_WORKING_CAPITAL'
    WHEN account_category = 'NON_CURRENT_ASSET' THEN 'INVESTING'
    WHEN account_category IN ('NON_CURRENT_LIABILITY', 'SHARE_CAPITAL', 'OTHER_EQUITY', 'RETAINED_EARNINGS') THEN 'FINANCING'
    WHEN account_type IN ('REVENUE', 'EXPENSE') THEN 'OPERATING_PL'
    ELSE 'UNCLASSIFIED'
  END AS cash_flow_section,
  opening_balance,
  period_debit,
  period_credit,
  period_net_movement,
  closing_balance
FROM vw_trial_balance;
