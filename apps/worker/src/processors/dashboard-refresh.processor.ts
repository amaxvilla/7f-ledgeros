import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, createRedisConnection, type DashboardRefreshJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_SECONDS = 10 * 60;

const DASHBOARD_ENDPOINTS = [
  'budget-vs-actual',
  'outstanding-payables-receivables',
  'cash-forecast',
  'loan-exposure',
  'bank-reconciliation-status',
  'top-projects-by-variance',
] as const;

@Processor(QUEUE_NAMES.DASHBOARD_REFRESH)
export class DashboardRefreshProcessor extends WorkerHost {
  private readonly logger = new Logger(DashboardRefreshProcessor.name);
  private readonly redis: IORedis;

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly prisma: PrismaService,
  ) {
    super();
    this.redis = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async process(job: Job<DashboardRefreshJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.dashboard_refresh'))) {
      this.logger.warn(`jobs.dashboard_refresh is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.DASHBOARD_REFRESH,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const entityIds = job.data.entityId
        ? [job.data.entityId]
        : (await this.prisma.entity.findMany({ where: { isActive: true }, select: { id: true } })).map((e: { id: string }) => e.id);

      let refreshed = 0;
      for (const entityId of entityIds) {
        for (const endpoint of DASHBOARD_ENDPOINTS) {
          try {
            const data = await this.api.get(`/dashboard/${endpoint}`, { entityId });
            await this.redis.set(
              `cache:dashboard:${endpoint}:${entityId}`,
              JSON.stringify(data),
              'EX',
              CACHE_TTL_SECONDS,
            );
            refreshed += 1;
          } catch (err) {
            // One failing widget (e.g. an entity with no treasury data) shouldn't
            // abort the refresh of the other widgets/entities.
            this.logger.warn(`Dashboard widget ${endpoint} failed for entity ${entityId}: ${(err as Error).message}`);
          }
        }
      }

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result: { widgetsRefreshed: refreshed } });
      return { entitiesRefreshed: entityIds.length, widgetsRefreshed: refreshed };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Dashboard refresh failed: ${error.message}`);
      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
