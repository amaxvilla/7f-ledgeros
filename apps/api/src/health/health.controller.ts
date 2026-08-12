import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { createRedisConnection, pingRedis } from '@7f/queue';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  private readonly redis = createRedisConnection(process.env.REDIS_URL ?? 'redis://localhost:6379');
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: process is up and able to respond. Does not check dependencies. */
  @Public()
  @ApiOperation({ summary: 'Liveness probe', description: 'Confirms the process is up and able to respond. Does not check dependencies (database, Redis) — see GET /ready for that.' })
  @Get('live')
  @HttpCode(HttpStatus.OK)
  live() {
    return { status: 'ok', uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000) };
  }

  /** Readiness: dependencies (DB, Redis) are reachable — safe to receive traffic. */
  @Public()
  @ApiOperation({ summary: 'Readiness probe', description: 'Checks that the database and Redis are both reachable. Returns 503 if either check fails — use this to gate whether the process should receive traffic.' })
  @Get('ready')
  async ready() {
    const [dbOk, redisOk] = await Promise.all([this.checkDatabase(), pingRedis(this.redis)]);
    const ready = dbOk && redisOk;
    const body = { status: ready ? 'ready' : 'not-ready', checks: { database: dbOk, redis: redisOk } };
    if (!ready) throw new ServiceUnavailableException(body);
    return body;
  }

  /** Combined health summary for dashboards/alerting. */
  @Public()
  @ApiOperation({ summary: 'Combined health summary', description: 'Same database/Redis checks as GET /ready, but always returns 200 (with a healthy/degraded status field) rather than a 503 — intended for dashboards and alerting rather than as a traffic gate.' })
  @Get('health')
  async health() {
    const [dbOk, redisOk] = await Promise.all([this.checkDatabase(), pingRedis(this.redis)]);
    return {
      status: dbOk && redisOk ? 'healthy' : 'degraded',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: { database: dbOk, redis: redisOk },
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
