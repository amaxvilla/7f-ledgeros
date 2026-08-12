import { Controller, Get, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ApiKeyGuard } from '../api-gateway/api-key.guard';
import { RateLimitGuard } from '../api-gateway/rate-limit.guard';
import { ApiScopeGuard } from '../api-gateway/api-scope.guard';
import { RequireApiScope } from '../api-gateway/require-api-scope.decorator';
import { CurrentApiKey, RequestApiKey } from '../api-gateway/current-api-key.decorator';
import { BankTransferService } from '../transfers/bank-transfer.service';
import { PaymentsService } from '../payments/payments.service';

/**
 * API Gateway, Checkpoint C — the first real partner-facing surface.
 *
 * Every route here authenticates via X-API-Key (ApiKeyGuard), not a JWT
 * — this controller is deliberately separate from BankTransferController
 * rather than adding API-key auth as an alternate path onto an existing
 * internal controller, for two reasons: (1) an internal controller's
 * response shape is designed for an authenticated employee who already
 * has RLS-scoped visibility into full record detail — a partner
 * response needs its own, deliberately narrower shape (see
 * toPartnerTransferStatus() below), and (2) mixing two very different
 * auth models onto the same routes makes it easy to accidentally leave
 * one of them under-guarded later.
 *
 * `@Public()` is REQUIRED here, not optional decoration — app.module.ts
 * registers JwtAuthGuard/PermissionsGuard/IpRestrictionGuard globally
 * (APP_GUARD), all of which expect a JWT; without @Public(), JwtAuthGuard
 * would reject every request before ApiKeyGuard below ever ran, since
 * this controller intentionally has no JWT to present at all. This is
 * the same escape hatch TwilioWebhookController/WhatsAppWebhookController
 * already use for their own non-JWT auth paths.
 *
 * `@UseGuards` order matters: ApiKeyGuard MUST run first (it's what
 * attaches `request.apiKey`), then RateLimitGuard and ApiScopeGuard both
 * read it — see each of those two guards' own doc comments for their
 * individual ordering requirements relative to ApiKeyGuard specifically.
 *
 * Checkpoint D adds the payment-side equivalents of Checkpoint C's
 * transfer status route — same reasoning, same narrow response shape
 * philosophy, same "add an unscoped-by-SecurityScope lookup method on
 * the owning service rather than querying Prisma directly here" pattern
 * (PaymentsService.findTransactionByReference /
 * findRefundByReference, mirroring BankTransferService.getByReference).
 *
 * Checkpoint E — Versioning. This controller's own path moves from
 * `partner-api` to `partner-api/v1` — explicit URL-path versioning,
 * scoped to the partner API specifically rather than a codebase-wide
 * change (main.ts's own `api/v1` global prefix already versions every
 * INTERNAL route; that's a separate, pre-existing mechanism this
 * checkpoint deliberately does not touch — see PartnerApiVersionController's
 * own doc comment for why the partner surface needs its own,
 * independent version number). Every route below keeps its existing
 * behavior unchanged; only the path segment changed, from
 * `/api/v1/partner-api/...` to `/api/v1/partner-api/v1/...`. Safe to do
 * now (no external partner has been issued a key against the
 * unversioned path yet — this is the intended time to introduce
 * versioning, before any real caller depends on the old path).
 */
@ApiTags('partner-api')
@ApiSecurity('apiKey')
@Public()
@Controller('partner-api/v1')
@UseGuards(ApiKeyGuard, RateLimitGuard, ApiScopeGuard)
export class PartnerApiController {
  constructor(
    private readonly bankTransfers: BankTransferService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * No @RequireApiScope — exists specifically so a partner can verify a
   * freshly-issued key actually works (right host, right header, not
   * expired/revoked) before requesting any real scope be granted to it.
   */
  @ApiOperation({
    summary: 'Verify an API key works',
    description: 'No scope required by design -- lets a partner confirm a freshly-issued key is valid (right host, right header, not expired/revoked) before requesting any real scope be granted to it.',
  })
  @Get('ping')
  ping(@CurrentApiKey() apiKey: RequestApiKey) {
    return { ok: true, keyId: apiKey.id, entityId: apiKey.entityId, scopes: apiKey.scopes };
  }

  /**
   * Deliberately returns a narrower shape than
   * BankTransferService.getByReference()'s own full row —
   * recipientAccountNumber/recipientBankCode/recipientName are never
   * included here. A partner checking "did the transfer I initiated (or
   * was told about) go through" needs status, not the recipient's bank
   * details re-served back to them over an API-key-authenticated route
   * that has no RLS scoping the way an internal JWT-authenticated
   * caller's request does.
   */
  @ApiOperation({
    summary: 'Get the status of a bank transfer by reference (partner-facing, narrow shape)',
    description:
      'Deliberately narrower than the internal record -- recipientAccountNumber/recipientBankCode/recipientName are never included, since this API-key-authenticated route has no RLS scoping the way an internal JWT-authenticated caller\'s request does.',
  })
  @Get('transfers/:reference/status')
  @RequireApiScope('transfers:read')
  async transferStatus(@Param('reference') reference: string) {
    const transfer = await this.bankTransfers.getByReference(reference);
    if (!transfer) throw new NotFoundException(`No transfer found for reference "${reference}"`);
    return this.toPartnerTransferStatus(transfer);
  }

  private toPartnerTransferStatus(transfer: {
    reference: string;
    status: string;
    amount: unknown;
    currency: string;
    completedAt: Date | null;
    failureReason: string | null;
  }) {
    return {
      reference: transfer.reference,
      status: transfer.status,
      amount: transfer.amount,
      currency: transfer.currency,
      completedAt: transfer.completedAt,
      failureReason: transfer.failureReason,
    };
  }

  /** Same narrow-shape reasoning as transferStatus() above — no
   *  customerEmail, description, metadata, authorizationUrl,
   *  providerReference, or rawVerification. */
  @ApiOperation({
    summary: 'Get the status of a payment transaction by reference (partner-facing, narrow shape)',
    description: 'Same narrow-shape reasoning as transfer status -- no customerEmail, description, metadata, authorizationUrl, providerReference, or rawVerification.',
  })
  @Get('payments/:reference/status')
  @RequireApiScope('payments:read')
  async paymentStatus(@Param('reference') reference: string) {
    const transaction = await this.payments.findTransactionByReference(reference);
    if (!transaction) throw new NotFoundException(`No payment found for reference "${reference}"`);
    return this.toPartnerPaymentStatus(transaction);
  }

  /** Same narrow-shape reasoning again — no rawResponse, no createdById. */
  @ApiOperation({
    summary: 'Get the status of a refund by reference (partner-facing, narrow shape)',
    description: 'Same narrow-shape reasoning again -- no rawResponse, no createdById.',
  })
  @Get('payments/refunds/:refundReference/status')
  @RequireApiScope('payments:read')
  async refundStatus(@Param('refundReference') refundReference: string) {
    const refund = await this.payments.findRefundByReference(refundReference);
    if (!refund) throw new NotFoundException(`No refund found for reference "${refundReference}"`);
    return this.toPartnerRefundStatus(refund);
  }

  private toPartnerPaymentStatus(transaction: {
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paidAt: Date | null;
  }) {
    return {
      reference: transaction.reference,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      paidAt: transaction.paidAt,
    };
  }

  private toPartnerRefundStatus(refund: { refundReference: string; status: string; amount: number; reason: string | null }) {
    return {
      refundReference: refund.refundReference,
      status: refund.status,
      amount: refund.amount,
      reason: refund.reason,
    };
  }
}
