import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import { ALL_QUEUE_NAMES } from '@7f/queue';
import { MetricsService } from './metrics.service';

@Injectable()
export class QueueMetricsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsListener.name);
  private listeners: QueueEvents[] = [];
  private jobStartedAt = new Map<string, number>();

  constructor(private readonly metrics: MetricsService) {}

  async onModuleInit() {
    const connection = {
      host: new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').hostname,
      port: Number(new URL(process.env.REDIS_URL ?? 'redis://localhost:6379').port || 6379),
    };

    for (const queueName of ALL_QUEUE_NAMES) {
      const events = new QueueEvents(queueName, { connection });

      events.on('active', ({ jobId }) => {
        this.jobStartedAt.set(jobId, Date.now());
      });

      events.on('completed', ({ jobId }) => {
        const duration = this.durationFor(jobId);
        this.metrics.recordJobOutcome(queueName, 'completed', duration);
      });

      events.on('failed', ({ jobId }) => {
        const duration = this.durationFor(jobId);
        this.metrics.recordJobOutcome(queueName, 'failed', duration);
      });

      this.listeners.push(events);
    }

    this.logger.log(`Queue metrics listeners attached for: ${ALL_QUEUE_NAMES.join(', ')}`);
  }

  async onModuleDestroy() {
    await Promise.all(this.listeners.map((l) => l.close()));
  }

  private durationFor(jobId: string): number {
    const startedAt = this.jobStartedAt.get(jobId);
    this.jobStartedAt.delete(jobId);
    return startedAt ? Date.now() - startedAt : 0;
  }
}
