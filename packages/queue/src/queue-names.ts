/**
 * Every BullMQ queue in the system. apps/api enqueues jobs onto these
 * queues; apps/worker registers one processor per queue. Keeping the names
 * here (rather than as string literals in each app) is what keeps the two
 * sides from drifting apart.
 */
export const QUEUE_NAMES = {
  PAYROLL_PROCESSING: 'payroll-processing',
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  BANK_STATEMENT_IMPORT: 'bank-statement-import',
  BUDGET_RECALCULATION: 'budget-recalculation',
  DASHBOARD_REFRESH: 'dashboard-refresh',
  REPORT_GENERATION: 'report-generation',
  // Release IA — Core Integration Framework (additive)
  INTEGRATION_HEALTH_CHECK: 'integration-health-check',
  // Release ID Part 1 — SMS Integration (Twilio, additive)
  SMS: 'sms',
  // Release ID.2 Part 1 — WhatsApp Cloud API (additive)
  WHATSAPP: 'whatsapp',
  // Release IE.1, Checkpoint E — Payment Framework reconciliation
  // (additive). Background re-verification of stale PENDING
  // PaymentTransaction rows, in case a webhook was missed or the
  // customer never returned from a hosted checkout redirect.
  PAYMENT_RECONCILIATION: 'payment-reconciliation',
  // Release IF.1, Checkpoint H — Bank Integration Framework (additive).
  // Scheduled statement sync for every ACTIVE MonoLinkedAccount, so a
  // linked account's transactions arrive without a user manually calling
  // POST /bank-integration/mono/linked-accounts/:id/import-statement.
  MONO_STATEMENT_SYNC: 'mono-statement-sync',
  // Enterprise Banking APIs, Transfer APIs — Checkpoint G (additive).
  // Scheduled re-verification of stale PENDING BankTransfer rows, the
  // same gap PaymentReconciliation closes for PaymentTransaction:
  // BankTransferService.verifyTransfer (Checkpoint F) exists but was
  // only ever reachable via POST /transfers/:id/verify, called by hand.
  // Provider-push (webhook) status updates remain a distinct, later
  // checkpoint — see BankTransferService.verifyTransfer's own doc
  // comment; this queue is pull/polling only.
  BANK_TRANSFER_RECONCILIATION: 'bank-transfer-reconciliation',
  // Digital Signature Providers, Checkpoint M (additive). Scheduled
  // re-check of SENT offers with an outstanding, unresolved signature
  // envelope — the same gap PAYMENT_RECONCILIATION/
  // BANK_TRANSFER_RECONCILIATION close for their own domains:
  // OfferService.checkSignatureStatus (Checkpoint L) exists but was
  // only ever reachable via POST /recruitment/offers/:id/check-signature-status,
  // called by hand. Provider-push (webhook) status updates remain a
  // distinct, later checkpoint — see OfferService.checkSignatureStatus's
  // own doc comment; this queue is pull/polling only, same posture
  // BANK_TRANSFER_RECONCILIATION's own comment already took.
  SIGNATURE_RECONCILIATION: 'signature-reconciliation',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ALL_QUEUE_NAMES: QueueName[] = Object.values(QUEUE_NAMES);

/** Default BullMQ job options, applied per-queue unless a caller overrides them. */
export const DEFAULT_JOB_OPTIONS: Record<QueueName, { attempts: number; backoffMs: number; removeOnCompleteAgeSeconds: number }> = {
  [QUEUE_NAMES.PAYROLL_PROCESSING]: { attempts: 3, backoffMs: 5000, removeOnCompleteAgeSeconds: 7 * 24 * 3600 },
  [QUEUE_NAMES.EMAIL]: { attempts: 5, backoffMs: 2000, removeOnCompleteAgeSeconds: 24 * 3600 },
  [QUEUE_NAMES.NOTIFICATION]: { attempts: 5, backoffMs: 2000, removeOnCompleteAgeSeconds: 24 * 3600 },
  [QUEUE_NAMES.BANK_STATEMENT_IMPORT]: { attempts: 2, backoffMs: 10000, removeOnCompleteAgeSeconds: 7 * 24 * 3600 },
  [QUEUE_NAMES.BUDGET_RECALCULATION]: { attempts: 3, backoffMs: 5000, removeOnCompleteAgeSeconds: 3 * 24 * 3600 },
  [QUEUE_NAMES.DASHBOARD_REFRESH]: { attempts: 2, backoffMs: 5000, removeOnCompleteAgeSeconds: 24 * 3600 },
  [QUEUE_NAMES.REPORT_GENERATION]: { attempts: 2, backoffMs: 10000, removeOnCompleteAgeSeconds: 7 * 24 * 3600 },
  [QUEUE_NAMES.INTEGRATION_HEALTH_CHECK]: { attempts: 3, backoffMs: 5000, removeOnCompleteAgeSeconds: 24 * 3600 },
  // Release ID Part 1 — a provider-level retryMaxAttempts/retryBackoffMs
  // (see IntegrationProvider), when one is configured for the active
  // TWILIO provider, overrides this default at enqueue time — see
  // NotificationProcessor's SMS branch. This is the fallback when no
  // provider is configured yet, same role every other row here plays.
  [QUEUE_NAMES.SMS]: { attempts: 3, backoffMs: 3000, removeOnCompleteAgeSeconds: 24 * 3600 },
  // Release ID.2 Part 1 — same "provider row can override at enqueue
  // time" shape as SMS above, via the active WHATSAPP_CLOUD provider's
  // retryMaxAttempts/retryBackoffMs (see NotificationProcessor's
  // WhatsApp branch).
  [QUEUE_NAMES.WHATSAPP]: { attempts: 3, backoffMs: 3000, removeOnCompleteAgeSeconds: 24 * 3600 },
  // Release IE.1, Checkpoint E — modest retry: a reconciliation run
  // that fails can simply run again at the next 15-minute schedule, so
  // this doesn't need SMS/WhatsApp's provider-level retry override.
  [QUEUE_NAMES.PAYMENT_RECONCILIATION]: { attempts: 2, backoffMs: 10000, removeOnCompleteAgeSeconds: 3 * 24 * 3600 },
  // Release IF.1, Checkpoint H — same modest-retry reasoning as
  // PAYMENT_RECONCILIATION above: a failed sync run simply picks up the
  // same unsynced window at the next scheduled run (lastSyncedAt is only
  // advanced on success), so there's no need for aggressive retries here.
  [QUEUE_NAMES.MONO_STATEMENT_SYNC]: { attempts: 2, backoffMs: 15000, removeOnCompleteAgeSeconds: 3 * 24 * 3600 },
  // Enterprise Banking APIs, Transfer APIs — Checkpoint G. Same modest
  // retry as PAYMENT_RECONCILIATION above (2 attempts, not aggressive):
  // a failed sweep run simply re-verifies the same still-PENDING
  // transfers at the next scheduled run.
  [QUEUE_NAMES.BANK_TRANSFER_RECONCILIATION]: { attempts: 2, backoffMs: 10000, removeOnCompleteAgeSeconds: 3 * 24 * 3600 },
  // Digital Signature Providers, Checkpoint M. Same modest retry as
  // BANK_TRANSFER_RECONCILIATION/PAYMENT_RECONCILIATION above: a failed
  // sweep run simply re-checks the same still-SENT offers at the next
  // scheduled run.
  [QUEUE_NAMES.SIGNATURE_RECONCILIATION]: { attempts: 2, backoffMs: 10000, removeOnCompleteAgeSeconds: 3 * 24 * 3600 },
};
