-- Release (CRM Reporting Integration, additive). Creates 1 read-only view
-- over the existing crm_leads/crm_prospects tables; no ALTER TABLE, no new
-- tables, no data migration. See sql/views/vw_crm_pipeline.sql for the
-- source-of-truth definition (this file just concatenates it, matching
-- the Phase 5A Real Estate Analytics view migration convention).

-- vw_crm_pipeline
-- Release (CRM Reporting Integration, following Phase 5A — Real Estate
-- Analytics' precedent of a statutory-grade ReportingService method
-- alongside — not replacing — the existing lightweight Dashboard widget).
--
-- One row per Lead, LEFT JOINed to its Prospect if it has converted.
-- Unlike vw_sales_velocity etc. this isn't bucketed into a time period —
-- the CRM funnel is a live, all-time snapshot (there's no fiscal-period
-- concept for a Lead/Prospect), matching how CrmService.getCrmPipelineSummary
-- (the existing, unscoped Dashboard-widget aggregation this view sits
-- alongside) already treats it.
--
-- days_in_pipeline measures Lead.createdAt through to whichever "closed"
-- timestamp applies (Prospect.wonAt for a won prospect, Prospect.updatedAt
-- for a lost one, since ProspectStatus.LOST has no dedicated timestamp
-- column), or through to now for anything still open.

CREATE OR REPLACE VIEW vw_crm_pipeline AS
SELECT
  l."id"                                  AS lead_id,
  l."entityId"                            AS entity_id,
  l."projectId"                           AS project_id,
  l."estateId"                            AS estate_id,
  (l."firstName" || ' ' || l."lastName")  AS lead_name,
  l."source"                              AS source,
  l."status"                              AS lead_status,
  l."assignedToId"                        AS assigned_to_id,
  (u."firstName" || ' ' || u."lastName")  AS assigned_to_name,
  l."createdAt"                           AS lead_created_at,
  l."convertedAt"                         AS lead_converted_at,
  p."id"                                  AS prospect_id,
  p."status"                              AS prospect_status,
  p."budgetMin"                           AS budget_min,
  p."budgetMax"                           AS budget_max,
  p."expectedCloseDate"                   AS expected_close_date,
  p."convertedCustomerId"                 AS converted_customer_id,
  p."wonAt"                               AS won_at,
  p."lostReason"                          AS lost_reason,
  EXTRACT(
    DAY FROM (
      COALESCE(p."wonAt", CASE WHEN p."status" = 'LOST' THEN p."updatedAt" END, CURRENT_TIMESTAMP)
      - l."createdAt"
    )
  )::int AS days_in_pipeline
FROM "crm_leads" l
LEFT JOIN "crm_prospects" p ON p."leadId" = l."id"
LEFT JOIN "users" u ON u."id" = l."assignedToId";
