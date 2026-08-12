import { createHash } from 'crypto';

/**
 * Feature flags are stored in the `feature_flags` table (see the
 * FeatureFlag model added to prisma/schema.prisma) and read independently
 * by apps/api (packages/config consumer: apps/api/src/feature-flags) and
 * apps/worker (apps/worker/src/feature-flags). Both sides share this pure
 * evaluation function so "is this flag on for this subject" never drifts
 * between the two processes — only the DB read differs.
 */
export interface FeatureFlagRecord {
  key: string;
  enabled: boolean;
  rolloutPercent: number | null;
}

/**
 * Deterministic rollout: hashes `subjectId` (e.g. entityId or userId) into
 * a stable 0-99 bucket so the same subject always gets the same answer for
 * a given flag, without needing to persist per-subject assignment.
 */
export function isFeatureEnabled(flag: FeatureFlagRecord | null | undefined, subjectId?: string): boolean {
  if (!flag || !flag.enabled) return false;
  if (flag.rolloutPercent == null) return true;
  if (flag.rolloutPercent >= 100) return true;
  if (flag.rolloutPercent <= 0) return false;
  if (!subjectId) return true; // no subject to bucket on — treat as fully enabled once `enabled` is true

  const hash = createHash('sha1').update(`${flag.key}:${subjectId}`).digest();
  const bucket = hash.readUInt32BE(0) % 100;
  return bucket < flag.rolloutPercent;
}

/** Default flags seeded on first boot if not already present in the DB. */
export const DEFAULT_FEATURE_FLAGS: Array<{ key: string; description: string; enabled: boolean }> = [
  { key: 'jobs.payroll_processing', description: 'Enable the payroll processing queue', enabled: true },
  { key: 'jobs.email_queue', description: 'Enable the email delivery queue', enabled: true },
  { key: 'jobs.notification_queue', description: 'Enable the in-app notification queue', enabled: true },
  { key: 'jobs.bank_statement_import', description: 'Enable async bank statement import', enabled: true },
  { key: 'jobs.budget_recalculation', description: 'Enable scheduled budget recalculation', enabled: true },
  { key: 'jobs.dashboard_refresh', description: 'Enable scheduled dashboard cache refresh', enabled: true },
  { key: 'jobs.report_generation', description: 'Enable async report generation', enabled: true },
  // Release IA — Core Integration Framework (additive)
  { key: 'jobs.integration_health_check', description: 'Enable scheduled health checks for registered integration providers', enabled: true },
  { key: 'jobs.sms_queue', description: 'Enable the SMS delivery queue (Release ID Part 1 — Twilio)', enabled: true },
  // Release ID.2 Part 1 — WhatsApp Cloud API. Fixing a verified defect:
  // WhatsAppProcessor (apps/worker/src/processors/whatsapp.processor.ts)
  // has read this key since Part 1, but it was never added here, so
  // FeatureFlagsService.ensureDefaults() never seeded a row for it —
  // isEnabled() returns false for any flag with no DB row (see
  // isFeatureEnabled's `if (!flag...) return false`), which meant the
  // entire WhatsApp outbound queue was silently disabled everywhere.
  { key: 'jobs.whatsapp_queue', description: 'Enable the WhatsApp delivery queue (Release ID.2 Part 1 — WhatsApp Cloud API)', enabled: true },
  { key: 'jobs.payment_reconciliation', description: 'Enable scheduled reconciliation of stale PENDING payment transactions (Release IE.1, Checkpoint E)', enabled: true },
  { key: 'jobs.mono_statement_sync', description: 'Enable scheduled statement sync for ACTIVE MonoLinkedAccount rows (Release IF.1, Checkpoint H)', enabled: true },
  { key: 'jobs.bank_transfer_reconciliation', description: 'Enable scheduled reconciliation of stale PENDING BankTransfer rows (Enterprise Banking APIs, Transfer APIs — Checkpoint G)', enabled: true },
  { key: 'jobs.signature_reconciliation', description: 'Enable scheduled re-check of SENT offers with an outstanding signature envelope (Digital Signature Providers — Checkpoint M)', enabled: true },
];
