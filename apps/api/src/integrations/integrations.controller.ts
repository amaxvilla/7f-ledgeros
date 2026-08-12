import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IntegrationCategory, IntegrationStatus } from '@prisma/client';
import { IntegrationsService } from './integrations.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  CreateIntegrationProviderDto,
  RotateIntegrationCredentialsDto,
  UpdateIntegrationProviderDto,
} from './dto/integration-provider.dto';

/**
 * Enterprise Integrations — a single registry (`IntegrationProvider`)
 * spanning every connector this app supports (Microsoft Graph, Google
 * Workspace, SMS, WhatsApp, Power BI, and more, per
 * `IntegrationCategory`'s own enum). Every response here is passed
 * through `IntegrationsService.redact()` first — no route on this
 * controller ever returns a decrypted (or even encrypted) credential
 * blob; only a derived `hasCredentials` boolean. Decrypted credentials
 * exist as an internal service method (`getDecryptedCredentials`) used
 * only by other services/provider drivers directly, never exposed over
 * HTTP at all — confirmed directly, not assumed from the absence of a
 * matching route.
 */
@ApiTags('integrations')
@ApiBearerAuth()
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Post()
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: 'Register a new integration provider',
    description:
      "entityId is optional — a provider can be entity-scoped or system-wide. credentials is a plaintext secret blob (API key, client secret, ...) in the request only; it is encrypted before ever reaching the database, and no route on this controller ever returns it back out.",
  })
  create(@Body() dto: CreateIntegrationProviderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrations.createProvider(dto, user.id);
  }

  @Get()
  @RequirePermissions('integrations.view')
  @ApiOperation({
    summary: 'List integration providers',
    description: 'entityId, category, and status are all optional filters, combinable freely.',
  })
  find(
    @Query('entityId') entityId?: string,
    @Query('category') category?: IntegrationCategory,
    @Query('status') status?: IntegrationStatus,
  ) {
    return this.integrations.findProviders({ entityId, category, status });
  }

  @Get('overview')
  @RequirePermissions('integrations.view')
  @ApiOperation({
    summary: 'Get provider counts by status and by active category',
    description: 'byStatus counts every provider regardless of isActive; activeByCategory counts active providers only — the two counts are not symmetric filters of the same set. Also reused by the Integrations Health dashboard widget.',
  })
  overview() {
    return this.integrations.getOverview();
  }

  @Get(':id')
  @RequirePermissions('integrations.view')
  @ApiOperation({ summary: 'Get a single integration provider by id' })
  get(@Param('id') id: string) {
    return this.integrations.getProvider(id);
  }

  @Put(':id')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: "Update a provider's own name/config/active flag/retry settings",
    description: 'Credentials are never updated through this route — use POST :id/rotate-credentials below, a deliberately separate, independently auditable action.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateIntegrationProviderDto) {
    return this.integrations.updateProvider(id, dto);
  }

  @Post(':id/rotate-credentials')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: "Replace a provider's own stored credentials",
    description: 'A dedicated endpoint rather than folded into PUT :id above, specifically so credential rotation is its own auditable action, separate from any other field change.',
  })
  rotateCredentials(@Param('id') id: string, @Body() dto: RotateIntegrationCredentialsDto) {
    return this.integrations.rotateCredentials(id, dto);
  }

  @Post(':id/health-check')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: 'Run this provider\'s own driver health check now',
    description:
      "Looks up the registered driver for this provider's own providerCode (falling back to a no-op driver if none is registered) and persists the result onto the row (status/lastHealthCheckAt/lastHealthCheckOk/lastHealthCheckError). If the provider itself is inactive, status is always set to INACTIVE regardless of the actual check result — an inactive provider never reports ACTIVE or ERROR from a stale check.",
  })
  healthCheck(@Param('id') id: string) {
    return this.integrations.runHealthCheck(id);
  }

  /** Called by the worker's scheduled integration-health-check job (see apps/worker/src/processors/integration-health-check.processor.ts). */
  @Post('health-check-all')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: 'Run a health check against every active provider',
    description: 'Same per-provider logic as POST :id/health-check above, applied to every currently-active provider; returns how many were checked and how many came back healthy. Also available as an on-demand "check everything now" action, not just the scheduled worker job that normally calls it.',
  })
  healthCheckAll() {
    return this.integrations.runHealthCheckAll();
  }
}
