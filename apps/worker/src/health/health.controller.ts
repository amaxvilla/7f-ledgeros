import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createRedisConnection, pingRedis, ALL_QUEUE_NAMES, QUEUE_NAMES } from '@7f/queue';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  private readonly redis = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.PAYROLL_PROCESSING) private readonly probeQueue: Queue,
  ) {}

  /** Liveness: process is up and able to respond. Does not check dependencies. */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000) };
  }

  /** Readiness: dependencies (DB, Redis) are reachable — safe to receive traffic/jobs. */
  @Get('ready')
  async ready() {
    const [dbOk, redisOk] = await Promise.all([this.checkDatabase(), pingRedis(this.redis)]);

    const ready = dbOk && redisOk;
    const body = { status: ready ? 'ready' : 'not-ready', checks: { database: dbOk, redis: redisOk } };

    if (!ready) {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }

  /** Combined health summary, including queue counts — for dashboards/alerting, not for load-balancer probes. */
  @Get('health')
  async health() {
    const [dbOk, redisOk, waitingJobs] = await Promise.all([
      this.checkDatabase(),
      pingRedis(this.redis),
      this.probeQueue.getWaitingCount().catch(() => -1),
    ]);

    return {
      status: dbOk && redisOk ? 'healthy' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: { database: dbOk, redis: redisOk },
      queues: ALL_QUEUE_NAMES,
      samplePayrollQueueDepth: waitingJobs,
    };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
