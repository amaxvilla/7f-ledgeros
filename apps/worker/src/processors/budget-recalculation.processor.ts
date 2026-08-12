import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import IORedis from 'ioredis';
import { QUEUE_NAMES, createRedisConnection, type BudgetRecalculationJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_SECONDS = 15 * 60;

@Processor(QUEUE_NAMES.BUDGET_RECALCULATION)
export class BudgetRecalculationProcessor extends WorkerHost {
  private readonly logger = new Logger(BudgetRecalculationProcessor.name);
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

  async process(job: Job<BudgetRecalculationJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.budget_recalculation'))) {
      this.logger.warn(`jobs.budget_recalculation is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.BUDGET_RECALCULATION,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const budgetIds = job.data.budgetId
        ? [job.data.budgetId]
        : (
            await this.prisma.budget.findMany({
              where: { status: 'APPROVED', ...(job.data.entityId ? { entityId: job.data.entityId } : {}) },
              select: { id: true },
            })
          ).map((b: { id: string }) => b.id);

      const results: Record<string, unknown> = {};
      for (const budgetId of budgetIds) {
        const variance = await this.api.get(`/budgets/${budgetId}/variance`);
        results[budgetId] = variance;
        await this.redis.set(`cache:budget-variance:${budgetId}`, JSON.stringify(variance), 'EX', CACHE_TTL_SECONDS);
      }

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result: { budgetsRecalculated: budgetIds.length } });
      return { budgetsRecalculated: budgetIds.length, results };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Budget recalculation failed: ${error.message}`);
      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
