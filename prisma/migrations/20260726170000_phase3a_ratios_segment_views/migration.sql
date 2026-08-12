-- vw_financial_ratios
-- Phase 3A — Financial Ratios.
--
-- Built on top of vw_trial_balance (balances) and account_category, the
-- same source every other Phase 3A statement uses, so ratios always tie
-- back to the Balance Sheet / P&L views rather than being derived
-- independently.
--
-- IMPORTANT — documented limitation: the schema's AccountCategory enum
-- classifies accounts into broad statutory buckets (CURRENT_ASSET,
-- CURRENT_LIABILITY, etc.) but has no finer tag for "this is Inventory"
-- vs "this is Cash" vs "this is Receivables" within CURRENT_ASSET, nor
-- "this is interest-bearing debt" within LIABILITY, nor "this is
-- Depreciation/Amortization" within OPERATING_EXPENSE. Those distinctions
-- are recovered here with an ILIKE match against ifrs_mapping/account_name
-- (e.g. '%inventory%', '%loan%', '%depreciation%'). This is a best-effort
-- heuristic, not a structural guarantee — an account named unconventionally
-- will be missed. A precise implementation needs a schema-level tag (e.g.
-- a `financialStatementRole` field on Account); flagged as follow-up work,
-- not silently assumed away.
--
-- Grain: one row per (entity, fiscal period).

CREATE OR REPLACE VIEW vw_financial_ratios AS
WITH base AS (
  SELECT * FROM vw_trial_balance
),
balances AS (
  SELECT
    entity_id,
    fiscal_period_id,
    period_name,
    period_start,
    period_end,
    SUM(CASE WHEN account_category = 'CURRENT_ASSET' THEN closing_balance ELSE 0 END) AS current_assets,
    SUM(CASE WHEN account_category = 'CURRENT_ASSET'
              AND (ifrs_mapping ILIKE '%inventory%' OR account_name ILIKE '%inventory%')
         THEN closing_balance ELSE 0 END) AS inventory_balance,
    SUM(CASE WHEN account_category = 'CURRENT_ASSET'
              AND (ifrs_mapping ILIKE '%receivable%' OR account_name ILIKE '%receivable%')
         THEN closing_balance ELSE 0 END) AS receivables_balance,
    SUM(CASE WHEN account_category = 'NON_CURRENT_ASSET' THEN closing_balance ELSE 0 END) AS non_current_assets,
    SUM(CASE WHEN account_category = 'CURRENT_LIABILITY' THEN closing_balance ELSE 0 END) AS current_liabilities,
    SUM(CASE WHEN account_category = 'CURRENT_LIABILITY'
              AND (ifrs_mapping ILIKE '%payable%' OR account_name ILIKE '%payable%')
         THEN closing_balance ELSE 0 END) AS payables_balance,
    SUM(CASE WHEN account_category = 'NON_CURRENT_LIABILITY' THEN closing_balance ELSE 0 END) AS non_current_liabilities,
    SUM(CASE WHEN account_category IN ('SHARE_CAPITAL', 'RETAINED_EARNINGS', 'OTHER_EQUITY')
         THEN closing_balance ELSE 0 END) AS total_equity,
    SUM(CASE WHEN account_category IN ('CURRENT_LIABILITY', 'NON_CURRENT_LIABILITY')
              AND (ifrs_mapping ILIKE '%loan%' OR ifrs_mapping ILIKE '%borrowing%'
                   OR account_name ILIKE '%loan%' OR account_name ILIKE '%borrowing%')
         THEN closing_balance ELSE 0 END) AS interest_bearing_debt
  FROM base
  GROUP BY entity_id, fiscal_period_id, period_name, period_start, period_end
),
flows AS (
  SELECT
    entity_id,
    fiscal_period_id,
    SUM(CASE WHEN account_category IN ('OPERATING_REVENUE', 'OTHER_REVENUE') THEN period_net_movement ELSE 0 END) AS revenue,
    SUM(CASE WHEN account_category = 'COST_OF_SALES' THEN period_net_movement ELSE 0 END) AS cost_of_sales,
    SUM(CASE WHEN account_category = 'OPERATING_EXPENSE' THEN period_net_movement ELSE 0 END) AS operating_expense,
    SUM(CASE WHEN account_category = 'OPERATING_EXPENSE'
              AND (ifrs_mapping ILIKE '%depreciation%' OR ifrs_mapping ILIKE '%amorti%'
                   OR account_name ILIKE '%depreciation%' OR account_name ILIKE '%amorti%')
         THEN period_net_movement ELSE 0 END) AS depreciation_amortization,
    SUM(CASE WHEN account_category = 'FINANCE_EXPENSE' THEN period_net_movement ELSE 0 END) AS finance_expense,
    SUM(CASE WHEN account_category = 'TAX_EXPENSE' THEN period_net_movement ELSE 0 END) AS tax_expense
  FROM base
  GROUP BY entity_id, fiscal_period_id
)
SELECT
  b.entity_id,
  b.fiscal_period_id,
  b.period_name,
  b.period_start,
  b.period_end,
  b.current_assets,
  b.inventory_balance,
  b.receivables_balance,
  b.non_current_assets,
  (b.current_assets + b.non_current_assets)                              AS total_assets,
  b.current_liabilities,
  b.payables_balance,
  b.non_current_liabilities,
  (b.current_liabilities + b.non_current_liabilities)                    AS total_liabilities,
  b.total_equity,
  b.interest_bearing_debt,
  f.revenue,
  f.cost_of_sales,
  (f.revenue - f.cost_of_sales)                                          AS gross_profit,
  f.operating_expense,
  f.depreciation_amortization,
  ((f.revenue - f.cost_of_sales) - f.operating_expense)                  AS operating_profit,
  f.finance_expense,
  f.tax_expense,
  (((f.revenue - f.cost_of_sales) - f.operating_expense)
      - f.finance_expense - f.tax_expense)                              AS net_profit,

  -- ---- Ratios ----
  CASE WHEN b.current_liabilities <> 0
       THEN ROUND(b.current_assets / b.current_liabilities, 4) END       AS current_ratio,
  CASE WHEN b.current_liabilities <> 0
       THEN ROUND((b.current_assets - b.inventory_balance) / b.current_liabilities, 4) END AS quick_ratio,
  CASE WHEN (b.current_assets + b.non_current_assets) <> 0
       THEN ROUND((b.current_liabilities + b.non_current_liabilities)
                   / (b.current_assets + b.non_current_assets), 4) END   AS debt_ratio,
  CASE WHEN b.total_equity <> 0
       THEN ROUND((b.current_liabilities + b.non_current_liabilities) / b.total_equity, 4) END AS debt_to_equity,
  CASE WHEN f.revenue <> 0
       THEN ROUND((f.revenue - f.cost_of_sales) / f.revenue, 4) END      AS gross_margin,
  CASE WHEN f.revenue <> 0
       THEN ROUND(((f.revenue - f.cost_of_sales) - f.operating_expense) / f.revenue, 4) END AS operating_margin,
  CASE WHEN f.revenue <> 0
       THEN ROUND((((f.revenue - f.cost_of_sales) - f.operating_expense)
                    - f.finance_expense - f.tax_expense) / f.revenue, 4) END AS net_margin,
  CASE WHEN (b.current_assets + b.non_current_assets) <> 0
       THEN ROUND((((f.revenue - f.cost_of_sales) - f.operating_expense)
                    - f.finance_expense - f.tax_expense)
                   / (b.current_assets + b.non_current_assets), 4) END   AS return_on_assets,
  CASE WHEN b.total_equity <> 0
       THEN ROUND((((f.revenue - f.cost_of_sales) - f.operating_expense)
                    - f.finance_expense - f.tax_expense) / b.total_equity, 4) END AS return_on_equity,
  (b.current_assets - b.current_liabilities)                             AS working_capital,
  (((f.revenue - f.cost_of_sales) - f.operating_expense)
      + f.depreciation_amortization)                                     AS ebitda,
  CASE WHEN f.finance_expense <> 0
       THEN ROUND(((f.revenue - f.cost_of_sales) - f.operating_expense) / f.finance_expense, 4) END AS interest_coverage,
  -- Cash Conversion Cycle = DIO + DSO - DPO, days in period from the
  -- fiscal period's own start/end (not a fixed 30/365), using period-end
  -- balances rather than period averages (no prior-period join here) —
  -- a simplification flagged in the header comment above, not a precise
  -- average-balance CCC.
  CASE WHEN f.cost_of_sales <> 0 AND f.revenue <> 0
       THEN ROUND(
              (b.inventory_balance / NULLIF(f.cost_of_sales, 0)) * (b.period_end::date - b.period_start::date + 1)
            + (b.receivables_balance / NULLIF(f.revenue, 0)) * (b.period_end::date - b.period_start::date + 1)
            - (b.payables_balance / NULLIF(f.cost_of_sales, 0)) * (b.period_end::date - b.period_start::date + 1)
            , 1)
  END AS cash_conversion_cycle_days
FROM balances b
JOIN flows f ON f.entity_id = b.entity_id AND f.fiscal_period_id = b.fiscal_period_id;
-- vw_segment_reporting
-- Phase 3A — Segment Reporting by Entity, Project, Department, Cost
-- Centre, Business Unit, and Funding Source.
--
-- Unlike the other Phase 3A statements, this is NOT built on top of
-- vw_trial_balance: that view is deliberately aggregated across all
-- dimensions per account (see its header comment), so it has no
-- project/department/cost-centre/funding-source breakdown left to
-- report on. This view goes back to journal_lines/journal_entries/
-- accounts directly, restricted to POSTED entries and REVENUE/EXPENSE
-- account types, then UNIONs one block per dimension so all six segment
-- types share one queryable shape (segment_type, segment_id,
-- segment_name).
--
-- Business Unit is not a journal-line dimension (JournalLine has no
-- businessUnitId column) — it is derived via the line's Entity, since
-- Entity.businessUnitId is how a Business Unit's entities are defined.
-- A line with no project/department/cost-centre/funding-source tagged,
-- or an entity with no business unit assigned, simply produces no row
-- for that segment type — it is not silently counted as "unassigned".
--
-- Grain: one row per (segment_type, segment_id, entity_id, fiscal_period_id).

CREATE OR REPLACE VIEW vw_segment_reporting AS
WITH posted_lines AS (
  SELECT
    jl."entityId"        AS entity_id,
    je."fiscalPeriodId"  AS fiscal_period_id,
    jl."projectId"       AS project_id,
    jl."departmentId"    AS department_id,
    jl."costCenterId"    AS cost_center_id,
    jl."fundingSourceId" AS funding_source_id,
    a."accountCategory"  AS account_category,
    jl.debit,
    jl.credit
  FROM "journal_lines" jl
  JOIN "journal_entries" je ON je."id" = jl."journalEntryId" AND je."status" = 'POSTED'
  JOIN "accounts" a ON a."id" = jl."accountId"
  WHERE a."accountType" IN ('REVENUE', 'EXPENSE')
),
by_segment AS (
  SELECT 'ENTITY' AS segment_type, pl.entity_id AS segment_id, e.name AS segment_name,
         pl.entity_id, pl.fiscal_period_id, pl.account_category, pl.debit, pl.credit
  FROM posted_lines pl
  JOIN "entities" e ON e."id" = pl.entity_id

  UNION ALL

  SELECT 'PROJECT', pl.project_id, p.name,
         pl.entity_id, pl.fiscal_period_id, pl.account_category, pl.debit, pl.credit
  FROM posted_lines pl
  JOIN "projects" p ON p."id" = pl.project_id
  WHERE pl.project_id IS NOT NULL

  UNION ALL

  SELECT 'DEPARTMENT', pl.department_id, d.name,
         pl.entity_id, pl.fiscal_period_id, pl.account_category, pl.debit, pl.credit
  FROM posted_lines pl
  JOIN "departments" d ON d."id" = pl.department_id
  WHERE pl.department_id IS NOT NULL

  UNION ALL

  SELECT 'COST_CENTER', pl.cost_center_id, cc.name,
         pl.entity_id, pl.fiscal_period_id, pl.account_category, pl.debit, pl.credit
  FROM posted_lines pl
  JOIN "cost_centers" cc ON cc."id" = pl.cost_center_id
  WHERE pl.cost_center_id IS NOT NULL

  UNION ALL

  SELECT 'FUNDING_SOURCE', pl.funding_source_id, fs.name,
         pl.entity_id, pl.fiscal_period_id, pl.account_category, pl.debit, pl.credit
  FROM posted_lines pl
  JOIN "funding_sources" fs ON fs."id" = pl.funding_source_id
  WHERE pl.funding_source_id IS NOT NULL

  UNION ALL

  SELECT 'BUSINESS_UNIT', e."businessUnitId", bu.name,
         pl.entity_id, pl.fiscal_period_id, pl.account_category, pl.debit, pl.credit
  FROM posted_lines pl
  JOIN "entities" e ON e."id" = pl.entity_id
  JOIN "business_units" bu ON bu."id" = e."businessUnitId"
  WHERE e."businessUnitId" IS NOT NULL
)
SELECT
  segment_type,
  segment_id,
  segment_name,
  entity_id,
  fiscal_period_id,
  SUM(CASE WHEN account_category IN ('OPERATING_REVENUE', 'OTHER_REVENUE') THEN credit - debit ELSE 0 END) AS revenue,
  SUM(CASE WHEN account_category = 'COST_OF_SALES' THEN debit - credit ELSE 0 END)                          AS cost_of_sales,
  SUM(CASE WHEN account_category = 'OPERATING_EXPENSE' THEN debit - credit ELSE 0 END)                      AS operating_expense,
  SUM(CASE WHEN account_category = 'FINANCE_EXPENSE' THEN debit - credit ELSE 0 END)                        AS finance_expense,
  SUM(CASE WHEN account_category = 'TAX_EXPENSE' THEN debit - credit ELSE 0 END)                            AS tax_expense,
  ( SUM(CASE WHEN account_category IN ('OPERATING_REVENUE', 'OTHER_REVENUE') THEN credit - debit ELSE 0 END)
    - SUM(CASE WHEN account_category = 'COST_OF_SALES' THEN debit - credit ELSE 0 END)
    - SUM(CASE WHEN account_category = 'OPERATING_EXPENSE' THEN debit - credit ELSE 0 END)
    - SUM(CASE WHEN account_category = 'FINANCE_EXPENSE' THEN debit - credit ELSE 0 END)
    - SUM(CASE WHEN account_category = 'TAX_EXPENSE' THEN debit - credit ELSE 0 END)
  ) AS net_profit
FROM by_segment
GROUP BY segment_type, segment_id, segment_name, entity_id, fiscal_period_id;
