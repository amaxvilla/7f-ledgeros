import { Controller, Delete, Get, Param, Post, Body, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MonoLinkedAccountService } from './mono-linked-account.service';
import { LinkMonoAccountDto } from './dto/link-mono-account.dto';
import { ImportMonoStatementDto } from './dto/import-mono-statement.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SecurityContextService } from '../security/security-context.service';

/**
 * Release IF.1, Checkpoint C. Deliberately its own controller rather than
 * added to BankReconciliationController — this is account *linking*
 * (Mono Connect consent), not reconciliation, and sits behind
 * bank_link.* permissions rather than bankrecon.* (see permissions.ts's
 * doc comment on that split).
 *
 * Every route here is RLS-checked against the linked account's own
 * BankAccount.entityId (there is no entityId column on MonoLinkedAccount
 * itself) — a 404, not a 403, on a scope miss, the same information-
 * hiding posture AccountsPayableService.findInvoice already uses
 * elsewhere. getOverview (a dashboard aggregate) and
 * applyLinkStatusWebhookEvent (called from the unauthenticated
 * BankWebhookController, not from here) both live on
 * MonoLinkedAccountService but deliberately have no route on THIS
 * controller — see each method's own doc comment for why.
 */
@ApiTags('bank-integration')
@ApiBearerAuth()
@Controller('bank-integration/mono')
export class MonoLinkedAccountController {
  constructor(
    private readonly monoLinkedAccounts: MonoLinkedAccountService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post('link')
  @RequirePermissions('bank_link.manage')
  @ApiOperation({
    summary: 'Link a bank account via Mono Connect',
    description: 'Exchanges a one-time Mono Connect widget code for a persisted link. Rejected with a 409 if the underlying Mono account is already linked to a bank account. Display metadata (institution name, masked account number, currency) is fetched best-effort — a failure there does not lose the link that already succeeded.',
  })
  async link(@Body() dto: LinkMonoAccountDto, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.monoLinkedAccounts.link(dto, user.id, scope);
  }

  @Get('linked-accounts')
  @RequirePermissions('bank_link.view')
  @ApiOperation({ summary: 'List Mono-linked accounts for a bank account', description: 'bankAccountId is required, not optional.' })
  async findByBankAccount(@Query('bankAccountId') bankAccountId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    if (!bankAccountId) {
      throw new BadRequestException('bankAccountId query param is required');
    }
    const scope = await this.securityContext.buildScope(user);
    return this.monoLinkedAccounts.findByBankAccount(bankAccountId, scope);
  }

  @Delete('linked-accounts/:id')
  @RequirePermissions('bank_link.manage')
  @ApiOperation({ summary: 'Revoke a Mono-linked account', description: 'Idempotent — revoking an already-revoked link returns it unchanged rather than erroring.' })
  async revoke(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.monoLinkedAccounts.revoke(id, scope);
  }

  /** Release IF.1, Checkpoint E. */
  @Get('linked-accounts/:id/balance')
  @RequirePermissions('bank_link.view')
  @ApiOperation({ summary: 'Get the current balance for a Mono-linked account', description: 'A thin pass-through to the Mono provider. Rejected with a 409 if the link is not currently ACTIVE.' })
  async getBalance(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const scope = await this.securityContext.buildScope(user);
    return this.monoLinkedAccounts.getBalance(id, scope);
  }

  /** Release IF.1, Checkpoint E. Pulls a Mono statement and imports it via
   *  BankReconciliationService — the resulting BankStatement then goes
   *  through the exact same reconciliation-session flow as any manually
   *  uploaded statement. */
  @Post('linked-accounts/:id/import-statement')
  @RequirePermissions('bank_link.manage')
  @ApiOperation({
    summary: 'Pull a Mono statement for a date range and import it as a bank statement',
    description: 'Rejected with a 409 if the link is not currently ACTIVE, or if Mono reports zero transactions for the range. openingBalance is derived (current balance minus this period\'s net change), not fetched — exact when toDate is "now," an approximation otherwise, since Mono has no balance-as-of-a-past-date endpoint.',
  })
  async importStatement(
    @Param('id') id: string,
    @Body() dto: ImportMonoStatementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.monoLinkedAccounts.importStatement(id, dto.fromDate, dto.toDate, user.id, scope);
  }
}
