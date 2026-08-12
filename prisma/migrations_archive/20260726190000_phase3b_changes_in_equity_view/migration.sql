-- vw_statement_changes_in_equity
-- Phase 3B — IFRS Statement of Changes in Equity (IAS 1).
--
-- Built ON TOP OF vw_statement_of_financial_position, filtered to its
-- EQUITY rows — not a re-derivation from journal_lines or vw_trial_balance
-- directly, so this view can never disagree with the Balance Sheet's
-- Equity total. Same reasoning as vw_statement_of_financial_position
-- itself being built on vw_trial_balance.
--
-- Grain: one row per (entity, fiscal period, account), same as its
-- source view. account_category is only SHARE_CAPITAL, RETAINED_EARNINGS,
-- or OTHER_EQUITY here (the schema has no finer-grained category for
-- Share Premium / Revaluation Reserve / FCTR / Dividends / Other
-- Reserves — see the ReportingService.buildChangesInEquity doc comment
-- for the ifrs_mapping/account_name heuristic used to recover those,
-- the same pattern vw_financial_ratios and the Cash Flow statement
-- already use for their own finer-grained distinctions).

CREATE OR REPLACE VIEW vw_statement_changes_in_equity AS
SELECT
  entity_id,
  fiscal_period_id,
  period_name,
  period_start,
  period_end,
  account_id,
  account_code,
  account_name,
  account_category,
  ifrs_mapping,
  opening_balance,
  period_net_movement,
  closing_balance
FROM vw_statement_of_financial_position
WHERE statement_section = 'EQUITY';
