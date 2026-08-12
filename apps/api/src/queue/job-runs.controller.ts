import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS } from '@7f/config';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('job-runs')
export class JobRunsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'List recent background job runs, optionally filtered by queue name or status',
    description: 'limit is silently capped at 200 regardless of what is requested (defaults to 50).',
  })
  @RequirePermissions(PERMISSIONS.JOB_RUNS_VIEW)
  async list(@Query('queueName') queueName?: string, @Query('status') status?: string, @Query('limit') limit = '50') {
    return this.prisma.jobRunLog.findMany({
      where: {
        ...(queueName ? { queueName } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 200),
    });
  }
}
