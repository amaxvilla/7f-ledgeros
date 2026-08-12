import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BankTransferStatus } from '@prisma/client';
import { BankTransferService } from './bank-transfer.service';
import { CreateBankTransferRecordDto } from './dto/bank-transfer.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SecurityContextService } from '../security/security-context.service';

/**
 * Enterprise Banking APIs, Transfer APIs — Checkpoint C.
 *
 * The gap BankTransferService's own Checkpoint B left open: the service
 * existed but had no controller, so nothing outside the module could
 * reach it. create()/findAll()/findOne()/findByReference() stay
 * record-management-only, same scope as the service methods they wrap.
 *
 * Checkpoint E adds initiate() — the one route that DOES reach
 * TransferProviderRegistry, via BankTransferService.initiateTransfer().
 *
 * Checkpoint F adds verify() the same way, via
 * BankTransferService.verifyTransfer() — see that method's doc comment
 * for why a verify failure behaves differently from an initiate
 * failure. `applyProviderResult` is still deliberately NOT exposed as
 * its own route — it's an internal hook initiateTransfer()/
 * verifyTransfer() (and a future webhook checkpoint) call directly, not
 * something an API caller should be able to set arbitrarily (that would
 * let a caller mark their own transfer SUCCESSFUL without a provider
 * ever having said so).
 */
@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class BankTransferController {
  constructor(
    private readonly bankTransfers: BankTransferService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Post()
  @RequirePermissions('bank_transfer.manage')
  @ApiOperation({
    summary: 'Create a bank transfer record',
    description: 'Idempotent on reference: a repeat call with a reference that already exists returns that same record unchanged rather than erroring. Does not itself contact any bank — call initiate separately to actually send it.',
  })
  create(@Body() dto: CreateBankTransferRecordDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bankTransfers.createRecord(dto, user.id);
  }

  /**
   * Deliberately a separate route from create() above, not folded into
   * it — see BankTransferService.initiateTransfer's own doc comment for
   * why this two-step shape is the seam a future approval gate needs.
   */
  @Post(':id/initiate')
  @RequirePermissions('bank_transfer.manage')
  @ApiOperation({
    summary: 'Initiate a pending transfer with its provider',
    description: 'Idempotent: a record already past PENDING, or one that already has a providerTransferId, is returned as-is rather than calling the provider again — a duplicate call here could mean a duplicate real-world bank transfer. On provider failure, persists FAILED + the failure reason, then re-throws — the caller always knows it failed, never a silent 200 with a status they might not check.',
  })
  initiate(@Param('id') id: string) {
    return this.bankTransfers.initiateTransfer(id);
  }

  /** See BankTransferService.verifyTransfer's own doc comment. */
  @Post(':id/verify')
  @RequirePermissions('bank_transfer.manage')
  @ApiOperation({
    summary: "Re-check a transfer's current status with its provider",
    description: "Callable regardless of current status, not just PENDING — re-verifying an already-SUCCESSFUL record is a legitimate reconciliation call. Deliberately asymmetric with initiate: a failure HERE means the status check itself failed (network/provider outage), not that the transfer failed, so the record's last-known status is left untouched rather than marked FAILED.",
  })
  verify(@Param('id') id: string) {
    return this.bankTransfers.verifyTransfer(id);
  }

  @Get()
  @RequirePermissions('bank_transfer.view')
  @ApiOperation({ summary: 'List bank transfers', description: 'RLS-scoped by entity. Optionally filtered by entityId/status/providerCode.' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId?: string,
    @Query('status') status?: BankTransferStatus,
    @Query('providerCode') providerCode?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.bankTransfers.findRecords(scope, { entityId, status, providerCode });
  }

  @Get(':id')
  @RequirePermissions('bank_transfer.view')
  @ApiOperation({ summary: 'Get a bank transfer by id' })
  findOne(@Param('id') id: string) {
    return this.bankTransfers.getRecord(id);
  }

  @Get('by-reference/:reference')
  @RequirePermissions('bank_transfer.view')
  @ApiOperation({ summary: 'Get a bank transfer by its own reference', description: 'The same reference createRecord is idempotent on.' })
  findByReference(@Param('reference') reference: string) {
    return this.bankTransfers.getByReference(reference);
  }
}
