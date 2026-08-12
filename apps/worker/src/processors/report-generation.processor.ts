import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, BadRequestException } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { QUEUE_NAMES, type ReportGenerationJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { LocalDiskStorageProvider } from '../storage/local-disk-storage.provider';

const REPORT_PATHS: Record<ReportGenerationJobData['reportKey'], string> = {
  'budget-vs-actual': 'budget-vs-actual',
  'project-profitability': 'project-profitability',
  'vendor-aging': 'vendor-aging',
  'customer-aging': 'customer-aging',
  'cash-forecast': 'cash-forecast',
  'bank-reconciliation-summary': 'bank-reconciliation-summary',
  'consolidated-trial-balance': 'consolidated-trial-balance',
};

/** Flattens an array of flat objects into CSV. Nested objects/arrays are JSON-stringified per cell. */
function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (value: unknown) => {
    const str = typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

@Processor(QUEUE_NAMES.REPORT_GENERATION)
export class ReportGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGenerationProcessor.name);
  private readonly storage = new LocalDiskStorageProvider();

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATION) private readonly notificationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<ReportGenerationJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.report_generation'))) {
      this.logger.warn(`jobs.report_generation is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.REPORT_GENERATION,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const path = REPORT_PATHS[job.data.reportKey];
      if (!path) throw new BadRequestException(`Unknown report key: ${job.data.reportKey}`);

      const data = await this.api.get(`/reporting/${path}`, {
        entityId: job.data.entityId,
        fiscalYear: job.data.fiscalYear,
      });

      const rows = Array.isArray(data) ? data : [data as Record<string, unknown>];
      const contentType = job.data.format === 'csv' ? 'text/csv' : 'application/json';
      const buffer = Buffer.from(job.data.format === 'csv' ? toCsv(rows) : JSON.stringify(data, null, 2), 'utf-8');
      const key = `reports/${job.data.reportKey}/${job.data.entityId}-${Date.now()}.${job.data.format}`;

      const upload = await this.storage.upload({ key, buffer, contentType });

      const notification = await this.prisma.notification.create({
        data: {
          userId: job.data.requestedByUserId,
          title: 'Report ready',
          body: `Your "${job.data.reportKey}" report is ready to download.`,
          metadata: { reportKey: job.data.reportKey, url: upload.url },
        },
      });
      await this.notificationQueue.add('deliver', { notificationId: notification.id });

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result: upload });
      return upload;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Report generation failed for ${job.data.reportKey}: ${error.message}`);

      const notification = await this.prisma.notification.create({
        data: {
          userId: job.data.requestedByUserId,
          title: 'Report generation failed',
          body: `Your "${job.data.reportKey}" report failed to generate: ${error.message}`,
          metadata: { reportKey: job.data.reportKey, error: error.message },
        },
      });
      await this.notificationQueue.add('deliver', { notificationId: notification.id });

      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
