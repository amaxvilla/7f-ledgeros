/**
 * Job payload contracts. Kept intentionally thin — IDs and the minimum
 * context needed to re-fetch state, not full denormalized snapshots — so
 * a job always acts on current data when the worker picks it up, rather
 * than stale data captured at enqueue time.
 */

export interface PayrollProcessingJobData {
  payrollRunId: string;
  /** id of the user who triggered the run, for attribution/audit */
  requestedByUserId: string;
}

export interface EmailJobData {
  to: string[];
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
  /** Correlates this send back to a Notification row, if any. */
  notificationId?: string;
}

export interface NotificationJobData {
  notificationId: string;
}

/** Release ID Part 1 — SMS Integration (Twilio, additive). */
export interface SmsJobData {
  to: string;
  body: string;
  /** Correlates this send back to a Notification row, if any. */
  notificationId?: string;
}

/** Release ID.2 Part 1 — WhatsApp Cloud API (additive). `to` is E.164, same format SmsJobData uses. */
export interface WhatsAppJobData {
  to: string;
  body: string;
  /** Correlates this send back to a Notification row, if any. */
  notificationId?: string;
}

export interface BankStatementImportJobData {
  entityId: string;
  bankAccountId: string;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  /** CSV file location (as returned by the storage module) with columns: transactionDate,description,reference,amount */
  fileUrl: string;
  importedByUserId: string;
}

export interface BudgetRecalculationJobData {
  /** Omit to recalculate all open budgets. */
  budgetId?: string;
  entityId?: string;
}

export interface DashboardRefreshJobData {
  /** Omit to refresh all active entities. */
  entityId?: string;
}

export interface ReportGenerationJobData {
  reportKey:
    | 'budget-vs-actual'
    | 'project-profitability'
    | 'vendor-aging'
    | 'customer-aging'
    | 'cash-forecast'
    | 'bank-reconciliation-summary'
    | 'consolidated-trial-balance';
  entityId: string;
  fiscalYear?: number;
  requestedByUserId: string;
  /** Where to notify the requester when the file is ready. */
  format: 'json' | 'csv';
}

/** Release IA — Core Integration Framework (additive). */
export interface IntegrationHealthCheckJobData {
  /** Omit to health-check every active IntegrationProvider. */
  integrationProviderId?: string;
}

/**
 * Release IE.1, Checkpoint E — Payment Framework reconciliation
 * (additive). Same "omit to run for every eligible row" convention as
 * IntegrationHealthCheckJobData above.
 */
export interface PaymentReconciliationJobData {
  /** Omit to reconcile every stale PENDING PaymentTransaction. */
  paymentTransactionId?: string;
  /** Release IE.2, Checkpoint G. Omit to reconcile every stale PENDING PaymentRefund. Independent of paymentTransactionId — a scheduled run reconciles both sets in the same job. */
  paymentRefundId?: string;
}

/**
 * Release IF.1, Checkpoint H — Bank Integration Framework (additive).
 * Same "omit to run for every eligible row" convention as
 * PaymentReconciliationJobData/IntegrationHealthCheckJobData above.
 */
export interface MonoStatementSyncJobData {
  /** Omit to sync every ACTIVE MonoLinkedAccount. */
  monoLinkedAccountId?: string;
}

/**
 * Enterprise Banking APIs, Transfer APIs — Checkpoint G. Same "omit to
 * run for every eligible row" convention as PaymentReconciliationJobData/
 * MonoStatementSyncJobData above.
 */
export interface BankTransferReconciliationJobData {
  /** Omit to reconcile every stale PENDING BankTransfer. */
  bankTransferId?: string;
}

/**
 * Digital Signature Providers, Checkpoint M. Same "omit to run for
 * every eligible row" convention as BankTransferReconciliationJobData/
 * PaymentReconciliationJobData above.
 */
export interface SignatureReconciliationJobData {
  /** Omit to check every stale SENT offer with an outstanding envelope. */
  offerId?: string;
}

export interface JobDataMap {
  'payroll-processing': PayrollProcessingJobData;
  email: EmailJobData;
  notification: NotificationJobData;
  'bank-statement-import': BankStatementImportJobData;
  'budget-recalculation': BudgetRecalculationJobData;
  'dashboard-refresh': DashboardRefreshJobData;
  'report-generation': ReportGenerationJobData;
  'integration-health-check': IntegrationHealthCheckJobData;
  'payment-reconciliation': PaymentReconciliationJobData;
  'mono-statement-sync': MonoStatementSyncJobData;
  'bank-transfer-reconciliation': BankTransferReconciliationJobData;
  'signature-reconciliation': SignatureReconciliationJobData;
}
