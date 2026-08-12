-- Release (Fixed Asset Reporting Integration, additive). Creates 1
-- read-only view over the existing fixed_assets/depreciation_entries/
-- asset_categories tables; no ALTER TABLE, no new tables, no data
-- migration. See sql/views/vw_fixed_asset_register.sql for the
-- source-of-truth definition (this file just concatenates it, matching
-- the CRM Reporting Integration migration convention).

-- vw_fixed_asset_register
-- Release (Fixed Assets Core). One row per Fixed Asset, joined to its
-- category and (if any) the most recent POSTED depreciation entry, so
-- accumulated_depreciation / net_book_value always reflect the latest
-- posted month rather than requiring the caller to re-aggregate
-- DepreciationEntry itself. Mirrors the precedent set by
-- vw_crm_pipeline: a statutory-grade ReportingService method sits
-- alongside — not replacing — FixedAssetsService.getFixedAssetSummary's
-- lighter Dashboard-widget aggregation.

CREATE OR REPLACE VIEW vw_fixed_asset_register AS
SELECT
  fa."id"                       AS fixed_asset_id,
  fa."entityId"                 AS entity_id,
  fa."assetTag"                 AS asset_tag,
  fa."name"                     AS asset_name,
  ac."name"                     AS category_name,
  fa."acquisitionDate"          AS acquisition_date,
  fa."acquisitionCost"          AS acquisition_cost,
  fa."residualValue"            AS residual_value,
  fa."usefulLifeYears"          AS useful_life_years,
  fa."status"                   AS status,
  fa."departmentId"             AS department_id,
  fa."costCenterId"             AS cost_center_id,
  fa."locationName"             AS location_name,
  latest."periodDate"           AS last_depreciated_period,
  COALESCE(latest."accumulatedDepreciation", 0) AS accumulated_depreciation,
  COALESCE(latest."netBookValue", fa."acquisitionCost") AS net_book_value
FROM "fixed_assets" fa
JOIN "asset_categories" ac ON ac."id" = fa."assetCategoryId"
LEFT JOIN LATERAL (
  SELECT de."periodDate", de."accumulatedDepreciation", de."netBookValue"
  FROM "depreciation_entries" de
  WHERE de."fixedAssetId" = fa."id" AND de."status" = 'POSTED'
  ORDER BY de."periodDate" DESC
  LIMIT 1
) latest ON true;
