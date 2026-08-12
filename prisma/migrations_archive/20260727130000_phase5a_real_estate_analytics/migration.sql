-- Phase 5A — Real Estate Analytics (additive). Creates 4 read-only
-- views over existing tables; no ALTER TABLE, no new tables, no data
-- migration. See sql/views/*.sql for the source-of-truth definitions
-- (this file just concatenates them, matching the Phase 3A view
-- migration convention).

-- vw_sales_velocity
-- Phase 5A — Real Estate Analytics (additive; reuses the existing
-- Unit/UnitReservation/UnitSaleAllocation schema, no new tables).
--
-- One row per (project, calendar month of allocation). "Sold" here means
-- a non-cancelled UnitSaleAllocation, matching how RevenueRecognitionService
-- and the Property Sales module already treat isCancelled = false as the
-- operative sale record. avg_days_to_sell measures reservedAt -> allocationDate
-- for allocations that originated from a reservation (convertedAllocationId
-- lineage on UnitReservation); allocations with no matching reservation
-- (direct sale) are excluded from the average but still counted in units_sold.

CREATE OR REPLACE VIEW vw_sales_velocity AS
SELECT
  pr."entityId"                                   AS entity_id,
  pr."id"                                         AS project_id,
  pr."code"                                       AS project_code,
  DATE_TRUNC('month', usa."allocationDate")::date AS sale_month,
  COUNT(*)                                        AS units_sold,
  SUM(usa."salePrice")                            AS total_sale_value,
  AVG(
    CASE WHEN res."reservedAt" IS NOT NULL
      THEN EXTRACT(DAY FROM (usa."allocationDate" - res."reservedAt"))
    END
  )                                                AS avg_days_to_sell
FROM "unit_sale_allocations" usa
JOIN "units" u   ON u."id" = usa."unitId"
JOIN "floors" f  ON f."id" = u."floorId"
JOIN "blocks" b  ON b."id" = f."blockId"
JOIN "phases" ph ON ph."id" = b."phaseId"
JOIN "projects" pr ON pr."id" = ph."projectId"
LEFT JOIN "unit_reservations" res ON res."convertedAllocationId" = usa."id"
WHERE usa."isCancelled" = false
GROUP BY pr."entityId", pr."id", pr."code", DATE_TRUNC('month', usa."allocationDate");

-- vw_inventory_ageing
-- Phase 5A — Real Estate Analytics (additive).
--
-- One row per unsold unit (status AVAILABLE or RESERVED — i.e. not yet
-- ALLOCATED/UNDER_CONTRACT/HANDED_OVER/SOLD), showing how long it has sat
-- in inventory. age_days is measured from the unit's own createdAt, since
-- that is the only "became available" timestamp the existing Unit model
-- carries; it will slightly overstate age for units re-listed after a
-- cancelled allocation (see vw_sales_velocity's isCancelled handling) —
-- there is no separate "re-listed at" timestamp in the current schema to
-- correct for that, which is called out as a known limitation in the
-- release report rather than silently assumed away.

CREATE OR REPLACE VIEW vw_inventory_ageing AS
SELECT
  pr."entityId"    AS entity_id,
  pr."id"          AS project_id,
  pr."code"        AS project_code,
  u."id"           AS unit_id,
  u."code"         AS unit_code,
  u."status"       AS unit_status,
  u."listPrice"    AS list_price,
  u."createdAt"    AS listed_at,
  EXTRACT(DAY FROM (NOW() - u."createdAt"))::int AS age_days,
  CASE
    WHEN EXTRACT(DAY FROM (NOW() - u."createdAt")) <= 30 THEN '0-30'
    WHEN EXTRACT(DAY FROM (NOW() - u."createdAt")) <= 60 THEN '31-60'
    WHEN EXTRACT(DAY FROM (NOW() - u."createdAt")) <= 90 THEN '61-90'
    WHEN EXTRACT(DAY FROM (NOW() - u."createdAt")) <= 180 THEN '91-180'
    ELSE '180+'
  END AS age_bucket
FROM "units" u
JOIN "floors" f  ON f."id" = u."floorId"
JOIN "blocks" b  ON b."id" = f."blockId"
JOIN "phases" ph ON ph."id" = b."phaseId"
JOIN "projects" pr ON pr."id" = ph."projectId"
WHERE u."status" IN ('AVAILABLE', 'RESERVED');

-- vw_absorption_rate
-- Phase 5A — Real Estate Analytics (additive).
--
-- One row per (project, calendar month). Absorption rate = units sold
-- that month / total units in the project, expressed as a percentage.
-- "Sold" reuses vw_sales_velocity's definition (non-cancelled
-- UnitSaleAllocation) rather than re-deriving it, so the two views can
-- never disagree on what counts as a sale.

CREATE OR REPLACE VIEW vw_absorption_rate AS
SELECT
  sv.entity_id,
  sv.project_id,
  sv.project_code,
  sv.sale_month,
  sv.units_sold,
  totals.total_units,
  CASE WHEN totals.total_units > 0
    THEN ROUND((sv.units_sold::numeric / totals.total_units) * 100, 2)
    ELSE NULL
  END AS absorption_rate_percent
FROM vw_sales_velocity sv
JOIN (
  SELECT pr."id" AS project_id, COUNT(u."id") AS total_units
  FROM "projects" pr
  JOIN "phases" ph ON ph."projectId" = pr."id"
  JOIN "blocks" b ON b."phaseId" = ph."id"
  JOIN "floors" f ON f."blockId" = b."id"
  JOIN "units" u ON u."floorId" = f."id"
  GROUP BY pr."id"
) totals ON totals.project_id = sv.project_id;

-- vw_unsold_units_dashboard
-- Phase 5A — Real Estate Analytics (additive).
--
-- One row per project: a snapshot count and total list-price value of
-- every unit not yet sold, broken out by status. Reuses the existing
-- UnitStatus enum values rather than introducing a parallel "unsold"
-- concept.

CREATE OR REPLACE VIEW vw_unsold_units_dashboard AS
SELECT
  pr."entityId" AS entity_id,
  pr."id"       AS project_id,
  pr."code"     AS project_code,
  COUNT(*) FILTER (WHERE u."status" = 'AVAILABLE')       AS available_count,
  COUNT(*) FILTER (WHERE u."status" = 'RESERVED')        AS reserved_count,
  COUNT(*) FILTER (WHERE u."status" = 'UNDER_CONTRACT')  AS under_contract_count,
  COUNT(*) FILTER (WHERE u."status" IN ('AVAILABLE','RESERVED','UNDER_CONTRACT')) AS total_unsold_count,
  SUM(u."listPrice") FILTER (WHERE u."status" IN ('AVAILABLE','RESERVED','UNDER_CONTRACT')) AS total_unsold_value
FROM "units" u
JOIN "floors" f  ON f."id" = u."floorId"
JOIN "blocks" b  ON b."id" = f."blockId"
JOIN "phases" ph ON ph."id" = b."phaseId"
JOIN "projects" pr ON pr."id" = ph."projectId"
GROUP BY pr."entityId", pr."id", pr."code";
