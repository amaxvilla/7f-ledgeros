-- vw_integrations_overview
-- Release IA — Core Integration Framework. One row per configured
-- integration provider, with the owning entity's name resolved (null for
-- system-wide providers) and a days-since-last-health-check column.
-- encryptedCredentials is intentionally never selected — this view backs
-- a reporting endpoint, and the API never returns decrypted or encrypted
-- credentials over HTTP (see IntegrationsService.redact).

CREATE OR REPLACE VIEW vw_integrations_overview AS
SELECT
  ip."id"                    AS provider_id,
  ip."entityId"               AS entity_id,
  e."name"                    AS entity_name,
  ip."category"                AS category,
  ip."providerCode"            AS provider_code,
  ip."name"                    AS name,
  ip."status"                  AS status,
  ip."isActive"                AS is_active,
  ip."retryMaxAttempts"        AS retry_max_attempts,
  ip."retryBackoffMs"          AS retry_backoff_ms,
  ip."lastHealthCheckAt"       AS last_health_check_at,
  ip."lastHealthCheckOk"       AS last_health_check_ok,
  ip."lastHealthCheckError"    AS last_health_check_error,
  CASE
    WHEN ip."lastHealthCheckAt" IS NULL THEN NULL
    ELSE GREATEST(0, (CURRENT_DATE - ip."lastHealthCheckAt"::date))
  END AS days_since_last_health_check,
  ip."createdAt"                AS created_at
FROM "integration_providers" ip
LEFT JOIN "entities" e ON e."id" = ip."entityId";
