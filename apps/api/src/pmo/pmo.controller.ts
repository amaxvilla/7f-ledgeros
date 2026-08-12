import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PmoDocStatus } from '@prisma/client';
import { PmoService } from './pmo.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('pmo')
@ApiBearerAuth()
@Controller('pmo')
export class PmoController {
  constructor(
    private readonly pmo: PmoService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- BOQ ----

  @Post('boqs')
  @ApiOperation({ summary: 'Create a draft Bill of Quantities for a project' })
  @RequirePermissions('pmo.manage')
  @RlsBodyCheck({ dimension: 'project', bodyField: 'projectId', mode: 'post' })
  createBoq(
    @Body() body: Omit<Parameters<PmoService['createBoq']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pmo.createBoq({ ...body, createdById: user.id });
  }

  @Get('boqs')
  @ApiOperation({ summary: 'List BOQs', description: 'RLS-scoped to the caller\'s project access; optionally further filtered by projectId.' })
  @RequirePermissions('pmo.view')
  async findBoqs(@CurrentUser() user: AuthenticatedUser, @Query('projectId') projectId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.pmo.findBoqs(scope, projectId);
  }

  @Post('boqs/:id/advance')
  @ApiOperation({
    summary: 'Advance (or reject) a BOQ\'s workflow status',
    description: 'Shared with every other PMO document type: DRAFT -> REVIEWED -> APPROVED -> CERTIFIED, one step at a time only — skipping a step is rejected with 409. REJECTED is reachable from any status as the one exception to the one-step rule.',
  })
  @RequirePermissions('pmo.approve')
  advanceBoq(@Param('id') id: string, @Body() body: { target: PmoDocStatus }) {
    return this.pmo.advanceBoqStatus(id, body.target);
  }

  // ---- Work Packages ----

  @Post('work-packages')
  @ApiOperation({ summary: 'Create a draft work package under a BOQ\'s project' })
  @RequirePermissions('pmo.manage')
  @RlsBodyCheck({ dimension: 'project', bodyField: 'projectId', mode: 'post' })
  createWorkPackage(
    @Body() body: Omit<Parameters<PmoService['createWorkPackage']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pmo.createWorkPackage({ ...body, createdById: user.id });
  }

  @Get('work-packages')
  @ApiOperation({ summary: 'List work packages', description: 'RLS-scoped to the caller\'s project access; optionally further filtered by projectId.' })
  @RequirePermissions('pmo.view')
  async findWorkPackages(@CurrentUser() user: AuthenticatedUser, @Query('projectId') projectId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.pmo.findWorkPackages(scope, projectId);
  }

  @Post('work-packages/:id/advance')
  @ApiOperation({ summary: 'Advance (or reject) a work package\'s workflow status', description: 'Same shared one-step DRAFT -> REVIEWED -> APPROVED -> CERTIFIED workflow as POST /pmo/boqs/:id/advance.' })
  @RequirePermissions('pmo.approve')
  advanceWorkPackage(@Param('id') id: string, @Body() body: { target: PmoDocStatus }) {
    return this.pmo.advanceWorkPackageStatus(id, body.target);
  }

  // ---- Progress Valuations ----

  @Post('progress-valuations')
  @ApiOperation({ summary: 'Create a draft progress valuation for a work package', description: 'valuationNumber is computed server-side (previous valuation\'s number + 1) and is never a request field.' })
  @RequirePermissions('pmo.manage')
  createProgressValuation(
    @Body() body: Omit<Parameters<PmoService['createProgressValuation']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pmo.createProgressValuation({ ...body, createdById: user.id });
  }

  @Get('work-packages/:workPackageId/progress-valuations')
  @ApiOperation({ summary: 'List progress valuations for a work package, including each one\'s certificate if it has one' })
  @RequirePermissions('pmo.view')
  findProgressValuations(@Param('workPackageId') workPackageId: string) {
    return this.pmo.findProgressValuations(workPackageId);
  }

  @Post('progress-valuations/:id/advance')
  @ApiOperation({ summary: 'Advance (or reject) a progress valuation\'s workflow status', description: 'Same shared one-step DRAFT -> REVIEWED -> APPROVED -> CERTIFIED workflow as POST /pmo/boqs/:id/advance. A valuation must be APPROVED before a certificate can be generated against it.' })
  @RequirePermissions('pmo.approve')
  advanceProgressValuation(@Param('id') id: string, @Body() body: { target: PmoDocStatus }) {
    return this.pmo.advanceProgressValuationStatus(id, body.target);
  }

  // ---- Interim Payment Certificates ----

  @Post('certificates')
  @ApiOperation({
    summary: 'Generate an interim payment certificate against an approved progress valuation',
    description: 'The referenced progress valuation must be APPROVED and must not already have a certificate — 409 otherwise. grossValuationAmount/retentionAmount/previousCertifiedAmount/netPayableAmount are all computed server-side, never request fields.',
  })
  @RequirePermissions('pmo.manage')
  generateCertificate(
    @Body() body: Omit<Parameters<PmoService['generateCertificate']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pmo.generateCertificate({ ...body, createdById: user.id });
  }

  @Post('certificates/:id/advance')
  @ApiOperation({
    summary: 'Advance (or reject) a certificate\'s workflow status',
    description: 'Same shared one-step DRAFT -> REVIEWED -> APPROVED -> CERTIFIED workflow as POST /pmo/boqs/:id/advance. Reaching CERTIFIED also rolls this certificate\'s own retentionAmount into the work package\'s running Retention record as a side effect.',
  })
  @RequirePermissions('pmo.approve')
  advanceCertificate(@Param('id') id: string, @Body() body: { target: PmoDocStatus }) {
    return this.pmo.advanceCertificateStatus(id, body.target);
  }

  // ---- Variation Orders ----

  @Post('variation-orders')
  @ApiOperation({ summary: 'Create a draft variation order against a work package' })
  @RequirePermissions('pmo.manage')
  createVariationOrder(
    @Body() body: Omit<Parameters<PmoService['createVariationOrder']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pmo.createVariationOrder({ ...body, createdById: user.id });
  }

  @Get('work-packages/:workPackageId/variation-orders')
  @ApiOperation({ summary: 'List variation orders for a work package' })
  @RequirePermissions('pmo.view')
  findVariationOrders(@Param('workPackageId') workPackageId: string) {
    return this.pmo.findVariationOrders(workPackageId);
  }

  @Post('variation-orders/:id/advance')
  @ApiOperation({
    summary: 'Advance (or reject) a variation order\'s workflow status',
    description: 'Same shared one-step DRAFT -> REVIEWED -> APPROVED -> CERTIFIED workflow as POST /pmo/boqs/:id/advance. Only APPROVED and CERTIFIED variation orders count toward a final account\'s totalVariations.',
  })
  @RequirePermissions('pmo.approve')
  advanceVariationOrder(@Param('id') id: string, @Body() body: { target: PmoDocStatus }) {
    return this.pmo.advanceVariationOrderStatus(id, body.target);
  }

  // ---- Retention ----

  @Get('work-packages/:workPackageId/retention')
  @ApiOperation({ summary: 'Get a work package\'s retention record, including its release history', description: '404 if no certificate has reached CERTIFIED for this work package yet — the retention record is created as a side effect of that, not on work package creation.' })
  @RequirePermissions('pmo.view')
  getRetention(@Param('workPackageId') workPackageId: string) {
    return this.pmo.getRetention(workPackageId);
  }

  @Post('retentions/:id/release')
  @ApiOperation({ summary: 'Release (part of) a work package\'s held retention', description: 'amount is a partial or full release, not a replacement value — rejected with 400 if it would exceed the retention\'s own remaining available amount (totalHeld minus what\'s already been released).' })
  @RequirePermissions('pmo.manage')
  releaseRetention(
    @Param('id') id: string,
    @Body() body: { amount: number; releaseDate: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pmo.releaseRetention(id, body.amount, body.releaseDate, user.id);
  }

  // ---- Final Account ----

  @Post('work-packages/:workPackageId/final-account')
  @ApiOperation({
    summary: 'Compute and create the final account for a work package',
    description: 'One-shot — 409 if a final account already exists for this work package. finalAccountAmount = the work package\'s own budgetAmount plus the sum of every APPROVED/CERTIFIED variation order; totalCertified is taken from the single latest CERTIFIED certificate\'s own grossValuationAmount, not summed across every certificate.',
  })
  @RequirePermissions('pmo.manage')
  computeFinalAccount(@Param('workPackageId') workPackageId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.pmo.computeFinalAccount(workPackageId, user.id);
  }

  @Post('final-accounts/:id/advance')
  @ApiOperation({ summary: 'Advance (or reject) a final account\'s workflow status', description: 'Same shared one-step DRAFT -> REVIEWED -> APPROVED -> CERTIFIED workflow as POST /pmo/boqs/:id/advance.' })
  @RequirePermissions('pmo.approve')
  advanceFinalAccount(@Param('id') id: string, @Body() body: { target: PmoDocStatus }) {
    return this.pmo.advanceFinalAccountStatus(id, body.target);
  }
}
