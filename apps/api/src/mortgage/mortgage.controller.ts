import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MortgageStatus } from '@prisma/client';
import { MortgageService } from './mortgage.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  ApproveMortgageDto,
  CreateMortgageApplicationDto,
  DeclineMortgageDto,
  DisburseMortgageDto,
} from './dto/mortgage.dto';

@ApiTags('mortgage')
@ApiBearerAuth()
@Controller('mortgage-applications')
export class MortgageController {
  constructor(
    private readonly mortgage: MortgageService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @RequirePermissions('mortgage.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create a mortgage application against a unit sale allocation', description: 'Rejected if the allocation does not exist. Starts in DRAFT.' })
  create(@Body() dto: CreateMortgageApplicationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.mortgage.createApplication(dto, user.id);
  }

  @Get()
  @RequirePermissions('mortgage.view')
  @ApiOperation({ summary: 'List mortgage applications', description: 'Row-level-security scoped by entity/businessUnit dimensions, then optionally filtered by entityId/status.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: MortgageStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.mortgage.findApplications(scope, { entityId, status });
  }

  @Get(':id')
  @RequirePermissions('mortgage.view')
  @ApiOperation({ summary: 'Get a mortgage application, with its allocation' })
  getOne(@Param('id') id: string) {
    return this.mortgage.getApplication(id);
  }

  @Post(':id/submit')
  @RequirePermissions('mortgage.manage')
  @ApiOperation({ summary: 'Submit a mortgage application for approval', description: 'Rejected unless the application is currently DRAFT.' })
  submit(@Param('id') id: string) {
    return this.mortgage.submitApplication(id);
  }

  @Post(':id/approve')
  @RequirePermissions('mortgage.manage')
  @ApiOperation({
    summary: 'Approve a submitted mortgage application',
    description: 'Rejected unless the application is currently SUBMITTED. interestRatePercent/tenorMonths fall back to the application\'s own originally-requested values when not given in the approval.',
  })
  approve(@Param('id') id: string, @Body() dto: ApproveMortgageDto) {
    return this.mortgage.approveApplication(id, dto);
  }

  @Post(':id/decline')
  @RequirePermissions('mortgage.manage')
  @ApiOperation({ summary: 'Decline a submitted mortgage application', description: 'Rejected unless the application is currently SUBMITTED.' })
  decline(@Param('id') id: string, @Body() dto: DeclineMortgageDto) {
    return this.mortgage.declineApplication(id, dto);
  }

  @Post(':id/disburse')
  @RequirePermissions('revenue.recognize')
  @ApiOperation({
    summary: 'Disburse an approved mortgage',
    description: 'Uses revenue.recognize, not mortgage.manage, unlike every other route in this controller (the same pattern HandoverController\'s own :id/complete route uses). Rejected unless the application is currently APPROVED, or if disbursedAmount exceeds the approved amount. Records the disbursement as an ordinary customer payment against the sale\'s installment schedule, reusing the existing Revenue Recognition module rather than duplicating GL posting logic here — the mortgage bank account is treated as just another source of cash.',
  })
  async disburse(@Param('id') id: string, @Body() dto: DisburseMortgageDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.mortgage.disburse(id, dto, user.id, scope);
  }

  @Post(':id/close')
  @RequirePermissions('mortgage.manage')
  @ApiOperation({ summary: 'Close a disbursed mortgage application', description: 'Rejected unless the application is currently DISBURSED.' })
  close(@Param('id') id: string) {
    return this.mortgage.closeApplication(id);
  }

  /**
   * FC-6.17 found `MortgageService.getMortgagePipelineSummary()` fully
   * implemented with no route exposing it, and named it explicit
   * remaining work rather than adding it inside a documentation-only
   * checkpoint. FC-6.18/6.19 (`getLeaseDashboardSummary`) found the
   * identical shape in Lease. This checkpoint closes both together, per
   * FC-6.18's own recommendation to treat them as one small follow-up.
   * Route path/permission mirror `RealEstateController`'s own
   * `reservations/pipeline-summary` and `CrmController`'s own
   * `pipeline-summary` exactly (`@Get('pipeline-summary')`,
   * `<domain>.view`) — no filter beyond the optional `entityId` the
   * service method itself already accepts (undefined is a no-op filter
   * in Prisma's own `where`, confirmed directly against the service
   * body — not a gap this route needs to work around).
   */
  @Get('pipeline-summary')
  @RequirePermissions('mortgage.view')
  @ApiOperation({
    summary: 'Mortgage pipeline counts and exposure totals',
    description: 'byStatus is a count per MortgageStatus value present in the (optionally entityId-filtered) result set. totalOutstanding is totalAmountApproved minus totalDisbursed, not a separately-tracked balance.',
  })
  getPipelineSummary(@Query('entityId') entityId?: string) {
    return this.mortgage.getMortgagePipelineSummary(entityId);
  }
}
