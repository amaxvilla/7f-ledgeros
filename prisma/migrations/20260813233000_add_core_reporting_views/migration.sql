-- Core operational reporting views.
-- Additive only. No tables, enums, or existing views are modified.

-- ---------------------------------------------------------------------------
-- Project profitability
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_project_profitability AS
WITH posted_project_lines AS (
    SELECT
        jl."entityId" AS entity_id,
        jl."projectId" AS project_id,
        a."accountType" AS account_type,
        jl.debit,
        jl.credit
    FROM journal_lines jl
    JOIN journal_entries je
      ON je.id = jl."journalEntryId"
    JOIN accounts a
      ON a.id = jl."accountId"
    WHERE je.status = 'POSTED'
      AND jl."projectId" IS NOT NULL
)
SELECT
    p."entityId" AS entity_id,
    p.id AS project_id,
    p.code AS project_code,
    p.name AS project_name,
    COALESCE(SUM(
        CASE
            WHEN ppl.account_type = 'REVENUE'
            THEN ppl.credit - ppl.debit
            ELSE 0
        END
    ), 0) AS revenue_amount,
    COALESCE(SUM(
        CASE
            WHEN ppl.account_type = 'EXPENSE'
            THEN ppl.debit - ppl.credit
            ELSE 0
        END
    ), 0) AS expense_amount,
    COALESCE(SUM(
        CASE
            WHEN ppl.account_type = 'REVENUE'
            THEN ppl.credit - ppl.debit
            WHEN ppl.account_type = 'EXPENSE'
            THEN -(ppl.debit - ppl.credit)
            ELSE 0
        END
    ), 0) AS profit_amount
FROM projects p
LEFT JOIN posted_project_lines ppl
  ON ppl.project_id = p.id
 AND ppl.entity_id = p."entityId"
GROUP BY
    p."entityId",
    p.id,
    p.code,
    p.name;


-- ---------------------------------------------------------------------------
-- Vendor aging
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_vendor_aging AS
WITH invoice_totals AS (
    SELECT
        vi.id AS invoice_id,
        vi."entityId" AS entity_id,
        vi."vendorId" AS vendor_id,
        vi."invoiceNumber" AS invoice_number,
        vi."invoiceDate" AS invoice_date,
        vi."dueDate" AS due_date,
        COALESCE(SUM(
            vil.quantity * vil."unitCost"
        ), 0)
        AS invoice_amount,
        vi."amountPaid" AS amount_paid,
        GREATEST(
            COALESCE(SUM(vil.quantity * vil."unitCost"), 0)
            - vi."amountPaid",
            0
        ) AS open_balance
    FROM vendor_invoices vi
    LEFT JOIN vendor_invoice_lines vil
      ON vil."vendorInvoiceId" = vi.id
    WHERE vi.status = 'POSTED'
      AND vi."dueDate" IS NOT NULL
    GROUP BY
        vi.id,
        vi."entityId",
        vi."vendorId",
        vi."invoiceNumber",
        vi."invoiceDate",
        vi."dueDate",
        vi."amountPaid"
)
SELECT
    it.entity_id,
    it.invoice_id,
    it.invoice_number,
    it.vendor_id,
    v.code AS vendor_code,
    v.name AS vendor_name,
    it.invoice_date,
    it.due_date,
    it.invoice_amount,
    it.amount_paid,
    it.open_balance,
    GREATEST(
        CURRENT_DATE - it.due_date::date,
        0
    )::integer AS days_past_due,
    CASE
        WHEN CURRENT_DATE <= it.due_date::date
            THEN 'CURRENT'
        WHEN CURRENT_DATE - it.due_date::date BETWEEN 1 AND 30
            THEN '1-30'
        WHEN CURRENT_DATE - it.due_date::date BETWEEN 31 AND 60
            THEN '31-60'
        WHEN CURRENT_DATE - it.due_date::date BETWEEN 61 AND 90
            THEN '61-90'
        ELSE '90+'
    END AS aging_bucket
FROM invoice_totals it
JOIN vendors v
  ON v.id = it.vendor_id
WHERE it.open_balance > 0.01;


-- ---------------------------------------------------------------------------
-- Customer aging
-- AR invoice total is VAT-inclusive because amountReceived is posted against
-- the gross invoice amount.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_customer_aging AS
WITH invoice_totals AS (
    SELECT
        ai.id AS invoice_id,
        ai."entityId" AS entity_id,
        ai."customerId" AS customer_id,
        ai."invoiceNumber" AS invoice_number,
        ai."invoiceDate" AS invoice_date,
        ai."dueDate" AS due_date,
        COALESCE(SUM(
            ail.quantity * ail."unitPrice"
            + COALESCE(ail."vatAmount", 0)
        ), 0) AS invoice_amount,
        ai."amountReceived" AS amount_received,
        GREATEST(
            COALESCE(SUM(
                ail.quantity * ail."unitPrice"
                + COALESCE(ail."vatAmount", 0)
            ), 0) - ai."amountReceived",
            0
        ) AS open_balance
    FROM ar_invoices ai
    LEFT JOIN ar_invoice_lines ail
      ON ail."arInvoiceId" = ai.id
    WHERE ai.status = 'POSTED'
      AND ai."dueDate" IS NOT NULL
    GROUP BY
        ai.id,
        ai."entityId",
        ai."customerId",
        ai."invoiceNumber",
        ai."invoiceDate",
        ai."dueDate",
        ai."amountReceived"
)
SELECT
    it.entity_id,
    it.invoice_id,
    it.invoice_number,
    it.customer_id,
    c.code AS customer_code,
    c.name AS customer_name,
    it.invoice_date,
    it.due_date,
    it.invoice_amount,
    it.amount_received,
    it.open_balance,
    GREATEST(
        CURRENT_DATE - it.due_date::date,
        0
    )::integer AS days_past_due,
    CASE
        WHEN CURRENT_DATE <= it.due_date::date
            THEN 'CURRENT'
        WHEN CURRENT_DATE - it.due_date::date BETWEEN 1 AND 30
            THEN '1-30'
        WHEN CURRENT_DATE - it.due_date::date BETWEEN 31 AND 60
            THEN '31-60'
        WHEN CURRENT_DATE - it.due_date::date BETWEEN 61 AND 90
            THEN '61-90'
        ELSE '90+'
    END AS aging_bucket
FROM invoice_totals it
JOIN customers c
  ON c.id = it.customer_id
WHERE it.open_balance > 0.01;


-- ---------------------------------------------------------------------------
-- Cash forecast
-- Mirrors DashboardService.getCashForecast():
-- 30 / 60 / 90 day cumulative horizons.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_cash_forecast AS
WITH horizons AS (
    SELECT 30::integer AS horizon_days
    UNION ALL
    SELECT 60::integer
    UNION ALL
    SELECT 90::integer
),
entities AS (
    SELECT id AS entity_id
    FROM entities
),
ap_open AS (
    SELECT
        vi."entityId" AS entity_id,
        vi.id AS invoice_id,
        vi."dueDate"::date AS due_date,
        GREATEST(
            COALESCE(SUM(vil.quantity * vil."unitCost"), 0)
            - vi."amountPaid",
            0
        ) AS open_balance
    FROM vendor_invoices vi
    LEFT JOIN vendor_invoice_lines vil
      ON vil."vendorInvoiceId" = vi.id
    WHERE vi.status = 'POSTED'
      AND vi."dueDate" IS NOT NULL
    GROUP BY
        vi."entityId",
        vi.id,
        vi."dueDate",
        vi."amountPaid"
),
ar_open AS (
    SELECT
        ai."entityId" AS entity_id,
        ai.id AS invoice_id,
        ai."dueDate"::date AS due_date,
        GREATEST(
            COALESCE(SUM(
                ail.quantity * ail."unitPrice"
                + COALESCE(ail."vatAmount", 0)
            ), 0)
            - ai."amountReceived",
            0
        ) AS open_balance
    FROM ar_invoices ai
    LEFT JOIN ar_invoice_lines ail
      ON ail."arInvoiceId" = ai.id
    WHERE ai.status = 'POSTED'
      AND ai."dueDate" IS NOT NULL
    GROUP BY
        ai."entityId",
        ai.id,
        ai."dueDate",
        ai."amountReceived"
)
SELECT
    e.entity_id,
    h.horizon_days,
    COALESCE((
        SELECT SUM(a.open_balance)
        FROM ap_open a
        WHERE a.entity_id = e.entity_id
          AND a.due_date <= CURRENT_DATE + h.horizon_days
    ), 0) AS outflow_amount,
    COALESCE((
        SELECT SUM(a.open_balance)
        FROM ar_open a
        WHERE a.entity_id = e.entity_id
          AND a.due_date <= CURRENT_DATE + h.horizon_days
    ), 0) AS inflow_amount,
    COALESCE((
        SELECT SUM(a.open_balance)
        FROM ar_open a
        WHERE a.entity_id = e.entity_id
          AND a.due_date <= CURRENT_DATE + h.horizon_days
    ), 0)
    -
    COALESCE((
        SELECT SUM(a.open_balance)
        FROM ap_open a
        WHERE a.entity_id = e.entity_id
          AND a.due_date <= CURRENT_DATE + h.horizon_days
    ), 0) AS net_amount
FROM entities e
CROSS JOIN horizons h;


-- ---------------------------------------------------------------------------
-- Bank reconciliation summary
-- One row per reconciliation session.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_bank_reconciliation_summary AS
SELECT
    rs.id AS reconciliation_session_id,
    rs."entityId" AS entity_id,
    rs."bankAccountId" AS bank_account_id,
    ba."accountName" AS bank_account_name,
    ba."bankName" AS bank_name,
    rs."statementId" AS statement_id,
    bs."statementDate" AS statement_date,
    bs."periodStart" AS period_start,
    bs."periodEnd" AS period_end,
    bs."openingBalance" AS statement_opening_balance,
    bs."closingBalance" AS statement_closing_balance,
    rs.status AS reconciliation_status,
    COUNT(rm.id) AS matched_transaction_count,
    COALESCE(SUM(rm."matchedAmount"), 0) AS matched_amount,
    COUNT(bsl.id) FILTER (WHERE bsl."isMatched" = false)
        AS unmatched_transaction_count,
    COALESCE(
        SUM(CASE WHEN bsl."isMatched" = false THEN bsl.amount ELSE 0 END),
        0
    ) AS unmatched_amount
FROM reconciliation_sessions rs
JOIN bank_accounts ba
  ON ba.id = rs."bankAccountId"
JOIN bank_statements bs
  ON bs.id = rs."statementId"
LEFT JOIN bank_statement_lines bsl
  ON bsl."statementId" = bs.id
LEFT JOIN reconciliation_matches rm
  ON rm."sessionId" = rs.id
GROUP BY
    rs.id,
    rs."entityId",
    rs."bankAccountId",
    ba."accountName",
    ba."bankName",
    rs."statementId",
    bs."statementDate",
    bs."periodStart",
    bs."periodEnd",
    bs."openingBalance",
    bs."closingBalance",
    rs.status;


-- ---------------------------------------------------------------------------
-- Consolidated trial balance
--
-- For an entity acting as a consolidation parent, aggregate its subsidiaries.
-- If no consolidation group exists for the requested entity, expose that
-- entity's own posted trial balance instead of returning nothing.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_consolidated_trial_balance AS
WITH group_members AS (
    SELECT
        cg.id AS consolidation_group_id,
        cg."parentEntityId" AS entity_id,
        cg."parentEntityId" AS member_entity_id
    FROM consolidation_groups cg
    WHERE cg."isActive" = true

    UNION ALL

    SELECT
        cg.id AS consolidation_group_id,
        cg."parentEntityId" AS entity_id,
        co."childEntityId" AS member_entity_id
    FROM consolidation_groups cg
    JOIN consolidation_ownerships co
      ON co."consolidationGroupId" = cg.id
    WHERE cg."isActive" = true
),
consolidated_lines AS (
    SELECT
        gm.entity_id,
        jl."accountId" AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        a."accountType" AS account_type,
        SUM(jl.debit) AS debit,
        SUM(jl.credit) AS credit
    FROM group_members gm
    JOIN journal_lines jl
      ON jl."entityId" = gm.member_entity_id
    JOIN journal_entries je
      ON je.id = jl."journalEntryId"
     AND je.status = 'POSTED'
    JOIN accounts a
      ON a.id = jl."accountId"
    GROUP BY
        gm.entity_id,
        jl."accountId",
        a.code,
        a.name,
        a."accountType"
),
standalone_lines AS (
    SELECT
        e.id AS entity_id,
        jl."accountId" AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        a."accountType" AS account_type,
        SUM(jl.debit) AS debit,
        SUM(jl.credit) AS credit
    FROM entities e
    JOIN journal_lines jl
      ON jl."entityId" = e.id
    JOIN journal_entries je
      ON je.id = jl."journalEntryId"
     AND je.status = 'POSTED'
    JOIN accounts a
      ON a.id = jl."accountId"
    WHERE NOT EXISTS (
        SELECT 1
        FROM consolidation_groups cg
        WHERE cg."parentEntityId" = e.id
          AND cg."isActive" = true
    )
    GROUP BY
        e.id,
        jl."accountId",
        a.code,
        a.name,
        a."accountType"
),
base AS (
    SELECT * FROM consolidated_lines
    UNION ALL
    SELECT * FROM standalone_lines
),
eliminations AS (
    SELECT
        coalesce(cg."parentEntityId", ie."consolidationGroupId") AS entity_id,
        SUM(ie."eliminationAmount") AS total_eliminated
    FROM intercompany_eliminations ie
    JOIN consolidation_groups cg
      ON cg.id = ie."consolidationGroupId"
    GROUP BY
        coalesce(cg."parentEntityId", ie."consolidationGroupId")
)
SELECT
    b.entity_id,
    b.account_id,
    b.account_code,
    b.account_name,
    b.account_type,
    b.debit,
    b.credit,
    COALESCE(el.total_eliminated, 0) AS total_eliminated
FROM base b
LEFT JOIN eliminations el
  ON el.entity_id = b.entity_id;
