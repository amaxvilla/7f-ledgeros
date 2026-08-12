import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import axios from 'axios';
import { QUEUE_NAMES, type BankStatementImportJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

interface ParsedLine {
  transactionDate: string;
  description: string;
  reference?: string;
  amount: number;
}

/**
 * Minimal CSV parser for the expected columns: transactionDate,description,reference,amount
 * (header row required). Kept intentionally simple — this is the one piece
 * of genuinely new parsing logic in this processor; everything after
 * parsing goes through BankReconciliationService.importStatement
 * (apps/api/src/bank-reconciliation/bank-reconciliation.service.ts) via
 * InternalApiClient, so the actual import/matching logic isn't duplicated.
 */
export function parseStatementCsv(raw: string): ParsedLine[] {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf('transactiondate');
  const descIdx = header.indexOf('description');
  const refIdx = header.indexOf('reference');
  const amountIdx = header.indexOf('amount');

  if (dateIdx === -1 || descIdx === -1 || amountIdx === -1) {
    throw new Error(
      `Statement CSV is missing required columns. Expected: transactionDate,description,reference,amount — got: ${header.join(',')}`,
    );
  }

  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      transactionDate: cols[dateIdx]?.trim(),
      description: cols[descIdx]?.trim() ?? '',
      reference: refIdx >= 0 ? cols[refIdx]?.trim() : undefined,
      amount: Number(cols[amountIdx]?.trim()),
    };
  });
}

@Processor(QUEUE_NAMES.BANK_STATEMENT_IMPORT)
export class BankStatementImportProcessor extends WorkerHost {
  private readonly logger = new Logger(BankStatementImportProcessor.name);

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<BankStatementImportJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.bank_statement_import'))) {
      this.logger.warn(`jobs.bank_statement_import is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.BANK_STATEMENT_IMPORT,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const { data: csvRaw } = await axios.get<string>(job.data.fileUrl, { responseType: 'text' });
      const lines = parseStatementCsv(csvRaw);

      const result = await this.api.post('/bank-reconciliation/import', {
        entityId: job.data.entityId,
        bankAccountId: job.data.bankAccountId,
        statementDate: job.data.statementDate,
        periodStart: job.data.periodStart,
        periodEnd: job.data.periodEnd,
        openingBalance: job.data.openingBalance,
        closingBalance: job.data.closingBalance,
        lines,
      });

      const notification = await this.prisma.notification.create({
        data: {
          userId: job.data.importedByUserId,
          title: 'Bank statement imported',
          body: `Statement for account ${job.data.bankAccountId} (${lines.length} lines) imported successfully.`,
          metadata: { bankAccountId: job.data.bankAccountId, lineCount: lines.length },
        },
      });
      await this.notificationQueue.add('deliver', { notificationId: notification.id });

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result });
      return result;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Bank statement import failed for account ${job.data.bankAccountId}: ${error.message}`);

      const notification = await this.prisma.notification.create({
        data: {
          userId: job.data.importedByUserId,
          title: 'Bank statement import failed',
          body: `Statement import for account ${job.data.bankAccountId} failed: ${error.message}`,
          metadata: { bankAccountId: job.data.bankAccountId, error: error.message },
        },
      });
      await this.notificationQueue.add('deliver', { notificationId: notification.id });

      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
