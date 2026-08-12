import { z } from 'zod';

/**
 * System configuration schema, shared by apps/api and apps/worker.
 *
 * Each process calls `loadSystemConfig()` once at startup. Validation
 * failures throw immediately (fail-fast on boot) rather than surfacing as
 * confusing runtime errors later (e.g. a worker silently unable to reach
 * Redis three jobs in).
 *
 * This intentionally validates only cross-cutting infrastructure config
 * (database, redis, queues, mail, monitoring). Domain-specific env reads
 * (e.g. CORS_ORIGINS, SWAGGER_ENABLED) stay where they are today in
 * apps/api/src/main.ts — this module does not take those over.
 */
const systemConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().optional(),

  // Worker internal service account — used to sign short-lived tokens for
  // the worker's calls back into the API. See @7f/config's jwt.ts and
  // apps/worker/src/internal-api/internal-api-client.ts.
  WORKER_SERVICE_USER_EMAIL: z.string().email().default('worker-service@7fifteencapital.com'),
  INTERNAL_API_BASE_URL: z.string().url().default('http://localhost:4000/api/v1'),

  // Mail transport (email queue). SMTP_HOST unset => worker logs emails
  // instead of sending them, which keeps local/dev usable without a mail
  // provider configured.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM_ADDRESS: z.string().default('no-reply@7fifteencapital.com'),

  // Queue dashboard / worker health server
  WORKER_HTTP_PORT: z.coerce.number().int().positive().default(4100),
  QUEUE_DASHBOARD_ENABLED: z.coerce.boolean().default(true),
  QUEUE_DASHBOARD_USER: z.string().default('admin'),
  QUEUE_DASHBOARD_PASSWORD: z.string().optional(),

  // Backup & disaster recovery
  BACKUP_DIR: z.string().default('/app/storage/backups'),
  BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  BACKUP_S3_BUCKET: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(true),
});

export type SystemConfig = z.infer<typeof systemConfigSchema>;

let cached: SystemConfig | null = null;

/**
 * Parses and validates process.env against the system config schema.
 * Cached after first call within a process — env vars are not expected to
 * change at runtime.
 */
export function loadSystemConfig(env: NodeJS.ProcessEnv = process.env): SystemConfig {
  if (cached) return cached;

  const result = systemConfigSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid system configuration:\n${issues}`);
  }

  if (result.data.NODE_ENV === 'production' && !result.data.JWT_ACCESS_SECRET) {
    throw new Error(
      'JWT_ACCESS_SECRET is not set. Refusing to start in production with an insecure default secret.',
    );
  }

  cached = result.data;
  return cached;
}

/** Test-only: clears the cached config so a test can reload with different env vars. */
export function resetSystemConfigCache(): void {
  cached = null;
}
