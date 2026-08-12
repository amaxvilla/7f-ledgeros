import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, type IntegrationHealthCheckJobData } from '@7f/queue';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/**
 * Release IA — Core Integration Framework. Calls back into the API
 * (same InternalApiClient pattern DashboardRefreshProcessor uses) so
 * this reuses IntegrationsService.runHealthCheck/runHealthCheckAll —
 * the one real implementation — instead of re-querying
 * integration_providers and re-deriving health status here.
 */
@Processor(QUEUE_NAMES.INTEGRATION_HEALTH_CHECK)
export class IntegrationHealthCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(IntegrationHealthCheckProcessor.name);

  constructor(
    private readonly api: InternalApiClient,
    private readonly jobRunLog: JobRunLogService,
    private readonly featureFlags: FeatureFlagsService,
  ) {
    super();
  }

  async process(job: Job<IntegrationHealthCheckJobData>): Promise<unknown> {
    if (!(await this.featureFlags.isEnabled('jobs.integration_health_check'))) {
      this.logger.warn(`jobs.integration_health_check is disabled — skipping job ${job.id}`);
      return { skipped: true };
    }

    await this.jobRunLog.recordStart({
      queueName: QUEUE_NAMES.INTEGRATION_HEALTH_CHECK,
      jobName: job.name,
      jobId: String(job.id),
      payload: job.data,
      attemptsMade: job.attemptsMade + 1,
    });

    try {
      const result = job.data.integrationProviderId
        ? await this.api.post(`/integrations/${job.data.integrationProviderId}/health-check`)
        : await this.api.post('/integrations/health-check-all');

      await this.jobRunLog.recordSuccess({ jobId: String(job.id), result });
      return result;
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Integration health check failed: ${error.message}`);
      await this.jobRunLog.recordFailure({ jobId: String(job.id), error, attemptsMade: job.attemptsMade + 1 });
      throw error;
    }
  }
}
