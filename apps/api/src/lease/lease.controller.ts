import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LeaseStatus, TenantStatus } from '@prisma/client';
import { LeaseService } from './lease.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';
import {
  CreateLeaseDto,
  CreateTenantDto,
  EndTenancyDto,
  GenerateRentInvoiceDto,
  PostRentInvoiceDto,
  RenewLeaseDto,
  TerminateLeaseDto,
} from './dto/lease.dto';

@ApiTags('lease')
@ApiBearerAuth()
@Controller('tenants')
export class TenantController {
  constructor(
    private readonly lease: LeaseService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a tenant (occupy a unit)', description: '404 if the unit or an active customer does not exist; 409 if the unit already has an ACTIVE tenant. Created as ACTIVE.' })
  @RequirePermissions('lease.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  create(@Body() dto: CreateTenantDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lease.createTenant(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List tenants', description: "RLS-scoped to the caller's entity/business-unit access; optionally filtered by entityId, unitId, and status. Each tenant includes its customer and unit." })
  @RequirePermissions('lease.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('unitId') unitId?: string,
    @Query('status') status?: TenantStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.lease.findTenants(scope, { entityId, unitId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a tenant', description: '404 if not found. Includes customer, unit, and all leases (newest first).' })
  @RequirePermissions('lease.view')
  getOne(@Param('id') id: string) {
    return this.lease.getTenant(id);
  }

  @Post(':id/end-tenancy')
  @ApiOperation({
    summary: 'End a tenancy',
    description: '404 if not found; 409 unless the tenancy is currently ACTIVE; 400 if the tenant still has a DRAFT or ACTIVE lease — terminate the lease first. Sets the tenant to FORMER.',
  })
  @RequirePermissions('lease.manage')
  endTenancy(@Param('id') id: string, @Body() dto: EndTenancyDto) {
    return this.lease.endTenancy(id, dto);
  }
}

@ApiTags('lease')
@ApiBearerAuth()
@Controller('leases')
export class LeaseController {
  constructor(
    private readonly lease: LeaseService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create a lease for a tenant',
    description: "404 if the tenant does not exist; 400 unless the tenant is ACTIVE, or if the lease's own unitId does not match the unit the tenant occupies; 409 if the lease number is already used for this entity, or if the unit already has a DRAFT or ACTIVE lease. Created as DRAFT.",
  })
  @RequirePermissions('lease.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  create(@Body() dto: CreateLeaseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lease.createLease(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List leases', description: "RLS-scoped to the caller's entity/business-unit access; optionally filtered by entityId, tenantId, and status. Each lease includes its tenant (with customer) and unit." })
  @RequirePermissions('lease.view')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: LeaseStatus,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.lease.findLeases(scope, { entityId, tenantId, status });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a lease', description: '404 if not found. Includes the tenant (with customer), unit, and every rent invoice (with its own AR invoice), newest period first.' })
  @RequirePermissions('lease.view')
  getOne(@Param('id') id: string) {
    return this.lease.getLease(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a lease', description: '404 if not found; 409 unless the lease is currently DRAFT.' })
  @RequirePermissions('lease.manage')
  activate(@Param('id') id: string) {
    return this.lease.activateLease(id);
  }

  @Post(':id/renew')
  @ApiOperation({
    summary: 'Renew a lease',
    description: '404 if not found; 409 unless the lease is currently ACTIVE or EXPIRED. Sets the lease back to ACTIVE with the new end date; the rent amount is only changed if a new one is supplied, otherwise it stays the same.',
  })
  @RequirePermissions('lease.manage')
  renew(@Param('id') id: string, @Body() dto: RenewLeaseDto) {
    return this.lease.renewLease(id, dto);
  }

  @Post(':id/expire')
  @ApiOperation({ summary: 'Mark a lease as expired', description: '404 if not found; 409 unless the lease is currently ACTIVE.' })
  @RequirePermissions('lease.manage')
  expire(@Param('id') id: string) {
    return this.lease.markExpired(id);
  }

  @Post(':id/terminate')
  @ApiOperation({
    summary: 'Terminate a lease early',
    description: '404 if not found; 409 unless the lease is currently DRAFT or ACTIVE. terminatedAt defaults to now if not supplied.',
  })
  @RequirePermissions('lease.manage')
  terminate(@Param('id') id: string, @Body() dto: TerminateLeaseDto) {
    return this.lease.terminateLease(id, dto);
  }

  @Post(':id/rent-invoices')
  @ApiOperation({
    summary: 'Generate a rent invoice for one period of an active lease',
    description: '404 if the lease does not exist; 409 unless it is currently ACTIVE. Creates a DRAFT AR invoice for the period via the Accounts Receivable module and links it to the lease — no GL posting logic is duplicated here; use the post route separately to post it.',
  })
  @RequirePermissions('lease.manage')
  generateRentInvoice(@Param('id') id: string, @Body() dto: GenerateRentInvoiceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.lease.generateRentInvoice(id, dto, user.id);
  }

  @Post('rent-invoices/:rentInvoiceId/post')
  @ApiOperation({ summary: 'Post a generated rent invoice to the GL', description: "404 if the rent-invoice link does not exist. Delegates to the Accounts Receivable module's own posting logic — no separate posting path for rent." })
  @RequirePermissions('revenue.recognize')
  postRentInvoice(
    @Param('rentInvoiceId') rentInvoiceId: string,
    @Body() dto: PostRentInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lease.postRentInvoice(rentInvoiceId, dto, user.id);
  }

  /**
   * FC-6.18 found `LeaseService.getLeaseDashboardSummary()` fully
   * implemented with no route exposing it — the same shape FC-6.17
   * already found for `MortgageService.getMortgagePipelineSummary()`.
   * Closed together in one small follow-up checkpoint (FC-6.19), per
   * FC-6.18's own recommendation. Route path/permission mirror
   * `MortgageController`'s own new `pipeline-summary` route (added in
   * the same checkpoint) and `RealEstateController`/`CrmController`'s
   * own pre-existing ones — `@Get('dashboard-summary')` rather than
   * `pipeline-summary`, since that's this service method's own name and
   * this resource genuinely isn't a sales/application pipeline the way
   * those three are.
   */
  @Get('dashboard-summary')
  @RequirePermissions('lease.view')
  @ApiOperation({
    summary: 'Lease portfolio counts and rent-roll total',
    description: 'expiringWithin60Days counts ACTIVE leases whose endDate falls within 60 days. monthlyRentRoll sums only ACTIVE leases with rentFrequency MONTHLY — QUARTERLY/ANNUALLY leases are deliberately excluded (the service\'s own comment states this is pending frequency normalization, not an oversight), so this figure understates total rent roll wherever non-monthly leases exist.',
  })
  getDashboardSummary(@Query('entityId') entityId?: string) {
    return this.lease.getLeaseDashboardSummary(entityId);
  }
}
