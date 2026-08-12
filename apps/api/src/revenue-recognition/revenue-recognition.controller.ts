import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RevenueRecognitionService } from './revenue-recognition.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';
import { SecurityContextService } from '../security/security-context.service';

@ApiTags('revenue-recognition')
@ApiBearerAuth()
@Controller('revenue-recognition')
export class RevenueRecognitionController {
  constructor(
    private readonly revenueRecognition: RevenueRecognitionService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // Release O follow-up — Entity-Level Security fix (verified defect, not
  // additive): entityId is no longer accepted from the client here. It's
  // derived server-side from the installment line and checked via
  // RowLevelSecurityService.canAccess(), the pattern this endpoint's own
  // comment previously flagged as the correct fix (see
  // RevenueRecognitionService.recordCustomerPayment for the full
  // rationale). This is a breaking body-shape change for existing callers
  // of this endpoint — they must stop sending entityId.
  @Post('customer-payments')
  @ApiOperation({
    summary: 'Record a customer installment payment (deferred-revenue posting)',
    description:
      'Posts Dr Bank / Cr Deferred Revenue for the payment. entityId is NOT part of the request body — it is derived server-side from the installment line and access-checked, not client-supplied.',
  })
  @RequirePermissions('revenue.recognize')
  async recordPayment(
    @Body()
    body: Omit<Parameters<RevenueRecognitionService['recordCustomerPayment']>[0], 'systemUserId'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.revenueRecognition.recordCustomerPayment({ ...body, systemUserId: user.id }, scope);
  }

  // Release O — Entity-Level Security: entityId comes straight from the
  // request body here, so it gets the same RlsBodyCheck as GL/payroll/
  // COA/bank-recon/tax above — previously any revenue.recognize holder
  // could recognize revenue against any entity.
  @Post('handovers')
  @ApiOperation({
    summary: 'Recognize revenue on unit handover',
    description:
      'Posts Dr Deferred Revenue / Cr Property Sales Revenue and Dr Cost of Sales / Cr Property Inventory in the same call — the second half of the IFRS 15 deferred-revenue pattern this module implements (see customer-payments for the first half).',
  })
  @RequirePermissions('revenue.recognize')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  recognizeHandover(
    @Body()
    body: Omit<Parameters<RevenueRecognitionService['recognizeOnHandover']>[0], 'systemUserId'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.revenueRecognition.recognizeOnHandover({ ...body, systemUserId: user.id });
  }
}
