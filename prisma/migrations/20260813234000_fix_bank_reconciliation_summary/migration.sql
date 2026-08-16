-- Correct bank reconciliation aggregation.
-- The previous view joined statement lines and reconciliation matches
-- at the same grain, which multiplied match totals when a statement
-- contained multiple lines.

CREATE OR REPLACE VIEW vw_bank_reconciliation_summary AS
WITH statement_stats AS (
    SELECT
        bs.id AS statement_id,
        COUNT(bsl.id) FILTER (
            WHERE bsl."isMatched" = false
        ) AS unmatched_transaction_count,
        COALESCE(
            SUM(
                CASE
                    WHEN bsl."isMatched" = false
                    THEN bsl.amount
                    ELSE 0
                END
            ),
            0
        ) AS unmatched_amount
    FROM bank_statements bs
    LEFT JOIN bank_statement_lines bsl
        ON bsl."statementId" = bs.id
    GROUP BY bs.id
),
match_stats AS (
    SELECT
        rm."sessionId" AS session_id,
        COUNT(rm.id) AS matched_transaction_count,
        COALESCE(SUM(rm."matchedAmount"), 0) AS matched_amount
    FROM reconciliation_matches rm
    GROUP BY rm."sessionId"
)
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
    COALESCE(ms.matched_transaction_count, 0) AS matched_transaction_count,
    COALESCE(ms.matched_amount, 0) AS matched_amount,
    COALESCE(ss.unmatched_transaction_count, 0) AS unmatched_transaction_count,
    COALESCE(ss.unmatched_amount, 0) AS unmatched_amount
FROM reconciliation_sessions rs
JOIN bank_accounts ba
    ON ba.id = rs."bankAccountId"
JOIN bank_statements bs
    ON bs.id = rs."statementId"
LEFT JOIN statement_stats ss
    ON ss.statement_id = rs."statementId"
LEFT JOIN match_stats ms
    ON ms.session_id = rs.id;