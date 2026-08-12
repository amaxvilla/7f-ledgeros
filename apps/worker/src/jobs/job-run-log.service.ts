import { Injectable, Logger } from '@nestjs/common';
import { JobRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobRunLogService {
  private readonly logger = new Logger(JobRunLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordStart(params: { queueName: string; jobName: string; jobId: string; payload?: unknown; attemptsMade?: number }) {
    try {
      await this.prisma.jobRunLog.create({
        data: {
          queueName: params.queueName,
          jobName: params.jobName,
          jobId: params.jobId,
          status: JobRunStatus.ACTIVE,
          payload: (params.payload ?? undefined) as never,
          attemptsMade: params.attemptsMade ?? 1,
          startedAt: new Date(),
        },
      });
    } catch (err) {
      // Job-run logging is observability, not correctness — never fail a job because
      // the audit row couldn't be written.
      this.logger.warn(`Failed to record job start for ${params.jobName}/${params.jobId}: ${(err as Error).message}`);
    }
  }

  async recordSuccess(params: { jobId: string; result?: unknown }) {
    try {
      await this.prisma.jobRunLog.updateMany({
        where: { jobId: params.jobId, status: JobRunStatus.ACTIVE },
        data: { status: JobRunStatus.COMPLETED, result: (params.result ?? undefined) as never, finishedAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`Failed to record job success for ${params.jobId}: ${(err as Error).message}`);
    }
  }

  async recordFailure(params: { jobId: string; error: Error; attemptsMade?: number }) {
    try {
      await this.prisma.jobRunLog.updateMany({
        where: { jobId: params.jobId, status: JobRunStatus.ACTIVE },
        data: {
          status: JobRunStatus.FAILED,
          errorMessage: params.error.message?.slice(0, 2000),
          attemptsMade: params.attemptsMade,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to record job failure for ${params.jobId}: ${(err as Error).message}`);
    }
  }
}
