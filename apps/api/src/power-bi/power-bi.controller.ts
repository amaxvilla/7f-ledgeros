import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PowerBiService } from './power-bi.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import {
  GetEmbedConfigQueryDto,
  GetRefreshStatusQueryDto,
  PublishDatasetDto,
  PushRowsDto,
  TriggerRefreshDto,
} from './dto/power-bi.dto';

/**
 * Mirrors CalendarService/ContactsService/TasksService elsewhere in
 * this codebase, including their scope decision, confirmed directly
 * against `PowerBiService`'s own doc comment: no Prisma persistence
 * here at all, and no opinion on which of this app's own data (GL
 * trial balance? PMO dashboards? HR headcount?) should be published as
 * a dataset — that decision is deferred entirely to whichever caller
 * uses this route. Every route below just makes the underlying Power
 * BI REST mechanism callable through a registered provider
 * (`providerCode`, resolved via `PowerBiProviderRegistry`); it doesn't
 * decide what gets published or store anything about a prior publish.
 */
@ApiTags('power-bi')
@ApiBearerAuth()
@Controller('power-bi')
export class PowerBiController {
  constructor(private readonly powerBi: PowerBiService) {}

  @Post('datasets')
  @ApiOperation({ summary: 'Publish a new Power BI dataset', description: 'The caller supplies the full table schema (names, columns, and each column\'s own data type) — this route has no default schema of its own.' })
  @RequirePermissions('power_bi.manage')
  publishDataset(@Body() dto: PublishDatasetDto) {
    return this.powerBi.publishDataset(dto);
  }

  @Post('datasets/:providerDatasetId/rows')
  @ApiOperation({ summary: 'Push rows into an existing dataset table', description: 'Rows are plain, caller-supplied objects — no schema validation against the table\'s own published columns happens at this layer.' })
  @RequirePermissions('power_bi.manage')
  pushRows(@Param('providerDatasetId') providerDatasetId: string, @Body() dto: PushRowsDto) {
    return this.powerBi.pushRows(providerDatasetId, dto);
  }

  @Post('datasets/:providerDatasetId/refresh')
  @ApiOperation({ summary: 'Trigger a dataset refresh' })
  @RequirePermissions('power_bi.manage')
  triggerRefresh(@Param('providerDatasetId') providerDatasetId: string, @Body() dto: TriggerRefreshDto) {
    return this.powerBi.triggerRefresh(providerDatasetId, dto);
  }

  @Get('datasets/:providerDatasetId/refresh')
  @ApiOperation({ summary: 'Get a dataset\'s current/last refresh status' })
  @RequirePermissions('power_bi.view')
  getRefreshStatus(@Param('providerDatasetId') providerDatasetId: string, @Query() query: GetRefreshStatusQueryDto) {
    return this.powerBi.getRefreshStatus(providerDatasetId, query.providerCode);
  }

  @Get('reports/:providerReportId/embed-config')
  @ApiOperation({ summary: 'Get embed configuration for a Power BI report', description: 'Returns whatever the registered provider needs the frontend to embed the report client-side (typically an embed URL and a short-lived token) — the exact shape is provider-specific, not fixed by this route.' })
  @RequirePermissions('power_bi.view')
  getEmbedConfig(@Param('providerReportId') providerReportId: string, @Query() query: GetEmbedConfigQueryDto) {
    return this.powerBi.getEmbedConfig(providerReportId, query.providerCode);
  }
}
