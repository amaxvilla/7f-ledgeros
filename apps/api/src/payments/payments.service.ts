import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentTransactionStatus, PaymentRefundStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentWebhookEvent, PaymentRefundWebhookEvent } from './payment-webhook-handler.interface';

/**
 * Release IE.1, Checkpoint D — the synchronous, work-doing layer this
 * framework has been missing since Checkpoints A-C: abstraction,
 * registry, and Prisma model all existed, but nothing yet actually
 * called PaymentProviderRegistry or wrote a PaymentTransaction row. This
 * is deliberately synchronous (no queue/worker involved) because
 * initializing a hosted checkout needs to return `authorizationUrl` to
 * the caller in the same HTTP response — the same reasoning
 * AwsS3StorageProvider's uploads run inside the API process rather than
 * the worker. A background reconciliation *worker* job (re-verifying a
 * stale PENDING transaction on a schedule, in case a webhook was missed)
 * is still a real, separate need — that's Checkpoint E (Queue) built on
 * top of the verifyPayment() this checkpoint provides, not a
 * replacement for it.
 *
 * Every method asserts RLS access against the transaction's own
 * entityId before touching it, the same assertEntityAccess pattern
 * every other financial service in this codebase uses (e.g.
 * AccountsPayableService) — not a payments-specific invention.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
    private readonly registry: PaymentProviderRegistry,
  ) {}

  private assertEntityAccess(scope: SecurityScope, entityId: string) {
    if (!this.rowLevelSecurity.canAccess(scope, { entityId }, { dimensions: ['entity', 'businessUnit'] })) {
      throw new ForbiddenException(`No access to payment data for entity ${entityId}`);
    }
  }

  async initializePayment(scope: SecurityScope, dto: InitializePaymentDto, userId: string) {
    this.assertEntityAccess(scope, dto.entityId);

    const existing = await this.prisma.paymentTransaction.findUnique({ where: { reference: dto.reference } });
    if (existing) {
      throw new ConflictException(
        `A payment transaction with reference "${dto.reference}" already exists (status: ${existing.status}) — reference must be unique per attempt, generate a new one to retry`,
      );
    }

    const provider = this.registry.get(dto.providerCode);
    const result = await provider.initializePayment({
      reference: dto.reference,
      amount: dto.amount,
      currency: dto.currency,
      customerEmail: dto.customerEmail,
      description: dto.description,
      callbackUrl: dto.callbackUrl,
      metadata: dto.metadata,
    });

    const transaction = await this.prisma.paymentTransaction.create({
      data: {
        reference: dto.reference,
        entityId: dto.entityId,
        providerCode: dto.providerCode,
        amount: dto.amount,
        currency: dto.currency,
        customerEmail: dto.customerEmail,
        description: dto.description,
        authorizationUrl: result.authorizationUrl,
        providerReference: result.providerReference,
        metadata: dto.metadata as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: 'PAYMENT_INITIALIZED', entityType: 'PaymentTransaction', entityId: transaction.id },
    });

    return transaction;
  }

  private async requireTransaction(scope: SecurityScope, reference: string) {
    const transaction = await this.prisma.paymentTransaction.findUnique({ where: { reference } });
    if (!transaction) {
      throw new NotFoundException(`Payment transaction "${reference}" not found`);
    }
    this.assertEntityAccess(scope, transaction.entityId);
    return transaction;
  }

  async verifyPayment(scope: SecurityScope, reference: string, userId?: string) {
    const transaction = await this.requireTransaction(scope, reference);
    const provider = this.registry.get(transaction.providerCode);
    const result = await provider.verifyPayment(reference);

    const updated = await this.prisma.paymentTransaction.update({
      where: { reference },
      data: {
        status: result.status as PaymentTransactionStatus,
        paidAt: result.paidAt,
        providerReference: result.providerReference ?? transaction.providerReference,
        rawVerification: (result.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PAYMENT_VERIFIED',
        entityType: 'PaymentTransaction',
        entityId: transaction.id,
        beforeState: { status: transaction.status },
        afterState: { status: updated.status },
      },
    });

    return updated;
  }

  /**
   * Release IE.1, Checkpoint F2 — applies an already-verified inbound
   * webhook event to its matching PaymentTransaction.
   *
   * Deliberately takes NO SecurityScope, unlike every other method on
   * this service: this is called from PaymentWebhookController, an
   * unauthenticated endpoint a payment provider posts to directly, the
   * same "no RLS check on this path" posture
   * TwilioWebhookService.applyStatusCallback() and
   * WhatsAppWebhookService.applyCallback() already use — there is no
   * user/SecurityScope for an inbound provider callback to be scoped
   * against. The signature check the controller performs before calling
   * this (PaymentWebhookHandler.verifySignature) is what authenticates
   * the caller instead of RLS.
   *
   * An unmatched reference is logged and returned as `{ matched: false }`
   * rather than thrown — same reasoning as
   * TwilioWebhookService.applyStatusCallback(): an unmatched webhook
   * isn't the provider's problem to retry over, and Checkpoint E's
   * reconciliation job already exists as the fallback for a transaction
   * this webhook never reaches.
   */
  async applyWebhookEvent(event: PaymentWebhookEvent): Promise<{ matched: boolean }> {
    const transaction = await this.prisma.paymentTransaction.findUnique({ where: { reference: event.reference } });
    if (!transaction) {
      this.logger.warn(`No payment transaction found for webhook reference "${event.reference}" (status=${event.status})`);
      return { matched: false };
    }

    const updated = await this.prisma.paymentTransaction.update({
      where: { reference: event.reference },
      data: {
        status: event.status as PaymentTransactionStatus,
        paidAt: event.paidAt,
        providerReference: event.providerReference ?? transaction.providerReference,
        rawVerification: (event.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'PAYMENT_WEBHOOK_RECEIVED',
        entityType: 'PaymentTransaction',
        entityId: transaction.id,
        beforeState: { status: transaction.status },
        afterState: { status: updated.status },
      },
    });

    return { matched: true };
  }

  /**
   * Release IE.2, Checkpoint E — the PaymentRefund counterpart to
   * applyWebhookEvent above. A refund initiated via refundPayment() below
   * may come back PENDING from Paystack (refunds are often processed
   * asynchronously on their side); this is what actually advances it to
   * SUCCESSFUL/FAILED once Paystack's refund.* webhook arrives, the same
   * relationship applyWebhookEvent has to initializePayment().
   */
  async applyRefundWebhookEvent(event: PaymentRefundWebhookEvent): Promise<{ matched: boolean }> {
    const refund = await this.prisma.paymentRefund.findUnique({ where: { refundReference: event.refundReference } });
    if (!refund) {
      this.logger.warn(`No payment refund found for webhook refundReference "${event.refundReference}" (status=${event.status})`);
      return { matched: false };
    }

    const updated = await this.prisma.paymentRefund.update({
      where: { refundReference: event.refundReference },
      data: {
        status: event.status as PaymentRefundStatus,
        rawResponse: (event.raw as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'PAYMENT_REFUND_WEBHOOK_RECEIVED',
        entityType: 'PaymentRefund',
        entityId: refund.id,
        beforeState: { status: refund.status },
        afterState: { status: updated.status },
      },
    });

    return { matched: true };
  }

  private async requireRefund(scope: SecurityScope, refundReference: string) {
    const refund = await this.prisma.paymentRefund.findUnique({
      where: { refundReference },
      include: { paymentTransaction: true },
    });
    if (!refund) {
      throw new NotFoundException(`Payment refund "${refundReference}" not found`);
    }
    this.assertEntityAccess(scope, refund.paymentTransaction.entityId);
    return refund;
  }

  /**
   * Release IE.2, Checkpoint G — Worker Integration (refund reconciliation).
   * The refund counterpart to verifyPayment above, with the identical
   * shape: look the row up (with RLS), call the provider's synchronous
   * verify method, persist the result, write an audit log entry. Exists
   * so PaymentReconciliationProcessor has something to call for a stale
   * PENDING PaymentRefund the same way it already calls
   * POST /payments/:reference/verify for a stale PaymentTransaction —
   * see that processor's updated doc comment.
   */
  async verifyRefund(scope: SecurityScope, refundReference: string, userId?: string) {
    const refund = await this.requireRefund(scope, refundReference);
    const provider = this.registry.get(refund.paymentTransaction.providerCode);
    const result = await provider.verifyRefund(refundReference);

    const updated = await this.prisma.paymentRefund.update({
      where: { refundReference },
      data: {
        status: result.status as PaymentRefundStatus,
        rawResponse: result as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'PAYMENT_REFUND_VERIFIED',
        entityType: 'PaymentRefund',
        entityId: refund.id,
        beforeState: { status: refund.status },
        afterState: { status: updated.status },
      },
    });

    return updated;
  }

  async refundPayment(scope: SecurityScope, reference: string, dto: RefundPaymentDto, userId: string) {
    const transaction = await this.requireTransaction(scope, reference);

    if (transaction.status !== PaymentTransactionStatus.SUCCESSFUL) {
      throw new BadRequestException(
        `Only a SUCCESSFUL payment can be refunded (transaction "${reference}" is ${transaction.status})`,
      );
    }
    if (dto.amount && dto.amount > transaction.amount) {
      throw new BadRequestException(`Refund amount (${dto.amount}) cannot exceed the original payment amount (${transaction.amount})`);
    }

    const provider = this.registry.get(transaction.providerCode);
    const result = await provider.refundPayment({ reference, amount: dto.amount, reason: dto.reason });

    const refund = await this.prisma.paymentRefund.create({
      data: {
        paymentTransactionId: transaction.id,
        refundReference: result.refundReference,
        amount: result.amount,
        status: result.status as PaymentRefundStatus,
        reason: dto.reason,
        rawResponse: result as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: 'PAYMENT_REFUNDED', entityType: 'PaymentTransaction', entityId: transaction.id, afterState: { refundReference: refund.refundReference, amount: refund.amount } },
    });

    return refund;
  }

  async findTransaction(scope: SecurityScope, reference: string) {
    const transaction = await this.requireTransaction(scope, reference);
    return this.prisma.paymentTransaction.findUnique({ where: { id: transaction.id }, include: { refunds: true } });
  }

  /**
   * Unscoped counterpart to findTransaction() above — no SecurityScope,
   * for callers that have no authenticated internal user to scope
   * against at all (an API-key-authenticated partner request has no
   * RLS-eligible User, only an ApiKey). Same reasoning and same shape as
   * BankTransferService.getByReference — see PartnerApiController for
   * the actual caller.
   */
  findTransactionByReference(reference: string) {
    return this.prisma.paymentTransaction.findUnique({ where: { reference } });
  }

  /** Unscoped counterpart to requireRefund() — same reasoning as
   *  findTransactionByReference() above, for PartnerApiController's
   *  refund status endpoint. */
  findRefundByReference(refundReference: string) {
    return this.prisma.paymentRefund.findUnique({ where: { refundReference } });
  }

  async listTransactions(scope: SecurityScope, entityId: string, filters: { status?: PaymentTransactionStatus; providerCode?: string } = {}) {
    this.assertEntityAccess(scope, entityId);
    return this.prisma.paymentTransaction.findMany({
      where: { entityId, status: filters.status, providerCode: filters.providerCode },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Release IE.1, Checkpoint G — Dashboard integration: per-status
   * transaction counts and amount totals for the payments summary tile.
   * Reuses the same assertEntityAccess RLS check every other method on
   * this service uses — same convention as
   * AccountsPayableService.getVendorAging / AccountsReceivableService.getAging,
   * which DashboardService.getOutstandingPayablesReceivables already
   * calls into, not a new dashboard-specific query bypassing RLS.
   *
   * amount is summed in the currency's minor unit, same as everywhere
   * else in this service — deliberately NOT split by currency (a mixed
   * NGN/USD total would be meaningless), so a future checkpoint that
   * needs a multi-currency-aware total should group by currency too,
   * not assume this total is safe to treat as a single currency once
   * more than one is in use for an entity.
   *
   * Release IE.2, Checkpoint H extends this with a refund summary
   * alongside the transaction one — before this, an ops user looking at
   * the payments dashboard had no way to see how much has actually been
   * refunded, or whether any refunds are stuck PENDING, without querying
   * the database directly. PaymentRefund has no entityId column of its
   * own (it belongs to a PaymentTransaction, which does), hence the
   * nested relation filter below rather than a plain `where: { entityId }`.
   */
  async getOverview(scope: SecurityScope, entityId: string) {
    this.assertEntityAccess(scope, entityId);

    const grouped = await this.prisma.paymentTransaction.groupBy({
      by: ['status'],
      where: { entityId },
      _count: { _all: true },
      _sum: { amount: true },
    });

    const byStatus: Record<string, { count: number; totalAmount: number }> = {};
    for (const status of Object.values(PaymentTransactionStatus)) {
      byStatus[status] = { count: 0, totalAmount: 0 };
    }
    for (const row of grouped) {
      byStatus[row.status] = { count: row._count._all, totalAmount: row._sum.amount ?? 0 };
    }

    const refundsGrouped = await this.prisma.paymentRefund.groupBy({
      by: ['status'],
      where: { paymentTransaction: { entityId } },
      _count: { _all: true },
      _sum: { amount: true },
    });

    const refundsByStatus: Record<string, { count: number; totalAmount: number }> = {};
    for (const status of Object.values(PaymentRefundStatus)) {
      refundsByStatus[status] = { count: 0, totalAmount: 0 };
    }
    for (const row of refundsGrouped) {
      refundsByStatus[row.status] = { count: row._count._all, totalAmount: row._sum.amount ?? 0 };
    }

    return {
      entityId,
      totalCount: grouped.reduce((sum, row) => sum + row._count._all, 0),
      successfulAmount: byStatus[PaymentTransactionStatus.SUCCESSFUL].totalAmount,
      byStatus,
      refundsByStatus,
      totalRefundedAmount: refundsByStatus[PaymentRefundStatus.SUCCESSFUL].totalAmount,
    };
  }
}
