import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PERMISSIONS, DEFAULT_FEATURE_FLAGS } from '@7f/config';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';

class UpsertFeatureFlagDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) rolloutPercent?: number;
}

@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List every feature flag', description: 'Idempotently seeds every known default flag on each call, so a flag never listed elsewhere in @7f/config will still appear here even before the worker\'s own ensureDefaults() has run.' })
  @RequirePermissions(PERMISSIONS.FEATURE_FLAGS_VIEW)
  async list() {
    // Idempotent — makes sure every known default flag shows up even before
    // the worker's own ensureDefaults() has run once.
    for (const flag of DEFAULT_FEATURE_FLAGS) {
      await this.prisma.featureFlag.upsert({
        where: { key: flag.key },
        create: { key: flag.key, description: flag.description, enabled: flag.enabled },
        update: {},
      });
    }
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  @Put(':key')
  @ApiOperation({ summary: 'Create or update a feature flag', description: 'A single endpoint handles both create and update (upsert on key) — there is no separate create-only route.' })
  @RequirePermissions(PERMISSIONS.FEATURE_FLAGS_MANAGE)
  async upsert(@Param('key') key: string, @Body() dto: UpsertFeatureFlagDto) {
    return this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled: dto.enabled, description: dto.description, rolloutPercent: dto.rolloutPercent },
      update: { enabled: dto.enabled, description: dto.description, rolloutPercent: dto.rolloutPercent },
    });
  }
}
