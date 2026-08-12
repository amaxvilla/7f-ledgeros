import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { PERMISSIONS } from '@7f/config';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, type AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { QueueProducerService } from './queue-producer.service';
import {
  TriggerBankStatementImportDto,
  TriggerBudgetRecalculationDto,
  TriggerDashboardRefreshDto,
  TriggerReportGenerationDto,
} from './dto/trigger-jobs.dto';

/**
 * Manual/admin entry points into the background job queues. These sit
 * alongside the existing synchronous endpoints (e.g.
 * `POST /hr/payroll-runs/:id/calculate`) rather than replacing them —
 * nothing here changes how an existing route behaves.
 */
@Controller('jobs')
export class JobsController {
  constructor(private readonly queue: QueueProducerService) {}

  @Post('bank-statement-import')
  @ApiOperation({ summary: 'Enqueue an async bank statement import job', description: 'Sits alongside the existing synchronous bank reconciliation endpoints -- nothing here changes how those behave; this is an additional, queued entry point.' })
  @RequirePermissions(PERMISSIONS.BANKRECON_MANAGE)
  async triggerBankStatementImport(@Body() dto: TriggerBankStatementImportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.queue.enqueueBankStatementImport({ ...dto, importedByUserId: user.id });
  }

  @Post('budget-recalculation')
  @ApiOperation({ summary: 'Enqueue an async budget recalculation job' })
  @RequirePermissions(PERMISSIONS.BUDGET_VIEW)
  async triggerBudgetRecalculation(@Body() dto: TriggerBudgetRecalculationDto) {
    return this.queue.enqueueBudgetRecalculation(dto);
  }

  @Post('dashboard-refresh')
  @ApiOperation({ summary: 'Enqueue an async dashboard cache refresh job' })
  @RequirePermissions(PERMISSIONS.WORKFLOW_VIEW)
  async triggerDashboardRefresh(@Body() dto: TriggerDashboardRefreshDto) {
    return this.queue.enqueueDashboardRefresh(dto);
  }

  @Post('report-generation')
  @ApiOperation({ summary: 'Enqueue an async report generation job' })
  @RequirePermissions(PERMISSIONS.GL_REPORTS_VIEW)
  async triggerReportGeneration(@Body() dto: TriggerReportGenerationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.queue.enqueueReportGeneration({ ...dto, requestedByUserId: user.id });
  }
}
