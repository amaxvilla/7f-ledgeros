-- Budget vs Actual reporting view
--
-- Mirrors BudgetingService.getActualForLine():
--   * one row per budget line
--   * revisedAmount is the budgeted amount
--   * actuals come only from POSTED journal entries
--   * period is the budget line's fiscal month
--   * entity and account always match
--   * project/phase/department/cost-center/funding-source are
--     conditional filters only when populated on the budget line
--   * debit-normal accounts (ASSET/EXPENSE) use debit - credit
--   * credit-normal accounts use credit - debit
--
-- This view is intentionally additive and does not modify any existing
-- migration or existing reporting view.

CREATE OR REPLACE VIEW vw_budget_vs_actual AS
SELECT
  b."entityId" AS entity_id,
  b."fiscalYear" AS fiscal_year,

  bl.id AS budget_line_id,
  bl."budgetId" AS budget_id,

  bl.period,

  bl."accountId" AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a."accountType" AS account_type,
  a."accountCategory" AS account_category,

  bl."projectId" AS project_id,
  bl."phaseId" AS phase_id,
  bl."departmentId" AS department_id,
  bl."costCenterId" AS cost_center_id,
  bl."fundingSourceId" AS funding_source_id,

  bl."originalAmount" AS original_amount,
  bl."revisedAmount" AS budgeted_amount,

  COALESCE(actuals.actual_amount, 0) AS actual_amount,

  bl."revisedAmount" - COALESCE(actuals.actual_amount, 0) AS variance_amount,

  CASE
    WHEN bl."revisedAmount" <> 0
      THEN ROUND(
        (
          COALESCE(actuals.actual_amount, 0)
          / bl."revisedAmount"
        ) * 100,
        2
      )
    ELSE NULL
  END AS utilization_percent

FROM "budget_lines" bl

JOIN "budgets" b
  ON b.id = bl."budgetId"

JOIN "accounts" a
  ON a.id = bl."accountId"

LEFT JOIN LATERAL (
  SELECT
    CASE
      WHEN a."accountType" IN ('ASSET', 'EXPENSE')
        THEN COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.credit), 0)
      ELSE
        COALESCE(SUM(jl.credit), 0) - COALESCE(SUM(jl.debit), 0)
    END AS actual_amount

  FROM "journal_lines" jl

  JOIN "journal_entries" je
    ON je.id = jl."journalEntryId"

  WHERE jl."accountId" = bl."accountId"
    AND jl."entityId" = b."entityId"

    AND je.status = 'POSTED'

    AND je."entryDate" >= make_date(b."fiscalYear", bl.period, 1)
    AND je."entryDate" < (
      make_date(b."fiscalYear", bl.period, 1)
      + INTERVAL '1 month'
    )

    AND (
      bl."projectId" IS NULL
      OR jl."projectId" = bl."projectId"
    )

    AND (
      bl."phaseId" IS NULL
      OR jl."phaseId" = bl."phaseId"
    )

    AND (
      bl."departmentId" IS NULL
      OR jl."departmentId" = bl."departmentId"
    )

    AND (
      bl."costCenterId" IS NULL
      OR jl."costCenterId" = bl."costCenterId"
    )

    AND (
      bl."fundingSourceId" IS NULL
      OR jl."fundingSourceId" = bl."fundingSourceId"
    )
) actuals
  ON TRUE;
