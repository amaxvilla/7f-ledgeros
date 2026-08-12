import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentTransactionStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SecurityContextService } from '../security/security-context.service';

/** Release IE.1, Checkpoint D. */
@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post('initialize')
  @RequirePermissions('payments.manage')
  @ApiOperation({
    summary: 'Initialize a hosted checkout payment',
    description:
      'Calls the registered PaymentProvider (e.g. Paystack) for the given providerCode synchronously and returns authorizationUrl for the caller to redirect the payer to; creates a PENDING PaymentTransaction row. reference must be unique — reusing one throws a conflict rather than starting a second attempt against it.',
  })
  async initialize(@CurrentUser() user: AuthenticatedUser, @Body() dto: InitializePaymentDto) {
    const scope = await this.securityContext.buildScope(user);
    return this.payments.initializePayment(scope, dto, user.id);
  }

  @Post(':reference/verify')
  @RequirePermissions('payments.manage')
  @ApiOperation({
    summary: "Verify a payment transaction's current status",
    description:
      "Re-queries the provider directly and updates the stored status/paidAt — the same operation the queue's own reconciliation job runs on a schedule for transactions still PENDING, available here to call on demand.",
  })
  async verify(@CurrentUser() user: AuthenticatedUser, @Param('reference') reference: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.payments.verifyPayment(scope, reference, user.id);
  }

  @Post(':reference/refund')
  @RequirePermissions('payments.manage')
  @ApiOperation({
    summary: 'Refund a successful payment',
    description:
      'Only a SUCCESSFUL transaction can be refunded (any other status is rejected); the refund amount cannot exceed the original payment amount. Creates a PaymentRefund row, whose own status may still be PENDING on return — Paystack refunds are often processed asynchronously and confirmed later via webhook or POST /refunds/:refundReference/verify below.',
  })
  async refund(@CurrentUser() user: AuthenticatedUser, @Param('reference') reference: string, @Body() dto: RefundPaymentDto) {
    const scope = await this.securityContext.buildScope(user);
    return this.payments.refundPayment(scope, reference, dto, user.id);
  }

  /** Release IE.2, Checkpoint G — Worker Integration (refund reconciliation). Same shape as POST /:reference/verify above, for a PaymentRefund instead of a PaymentTransaction. */
  @Post('refunds/:refundReference/verify')
  @RequirePermissions('payments.manage')
  @ApiOperation({
    summary: "Verify a refund's current status",
    description: "Same shape as POST /:reference/verify above, re-queried against the provider directly, but for a PaymentRefund rather than the original PaymentTransaction.",
  })
  async verifyRefund(@CurrentUser() user: AuthenticatedUser, @Param('refundReference') refundReference: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.payments.verifyRefund(scope, refundReference, user.id);
  }

  @Get(':reference')
  @RequirePermissions('payments.view')
  @ApiOperation({ summary: 'Get a payment transaction by its reference' })
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('reference') reference: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.payments.findTransaction(scope, reference);
  }

  @Get()
  @RequirePermissions('payments.view')
  @ApiOperation({
    summary: 'List payment transactions for an entity',
    description: 'entityId is required; status and providerCode are both optional filters on top of it.',
  })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('status') status?: PaymentTransactionStatus,
    @Query('providerCode') providerCode?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.payments.listTransactions(scope, entityId, { status, providerCode });
  }
}
