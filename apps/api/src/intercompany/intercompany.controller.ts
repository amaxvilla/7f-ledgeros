import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReconciliationStatus } from '@prisma/client';
import { IntercompanyService } from './intercompany.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('intercompany')
@ApiBearerAuth()
@Controller('intercompany')
export class IntercompanyController {
  constructor(private readonly intercompany: IntercompanyService) {}

  @Post()
  @ApiOperation({
    summary: 'Record an intercompany transaction: the initiator\'s journal entry plus an automatic mirror entry on the counterparty\'s books',
    description:
      'Both entries post as Dr due-from/Cr [account] on the initiator side and Dr [account]/Cr due-to on the mirror side, linked via one IntercompanyTransaction record for later reconciliation and consolidation elimination. Rejected if initiatorEntityId equals counterpartyEntityId, or if amount is not positive.',
  })
  @RequirePermissions('intercompany.create')
  create(
    @Body()
    body: Omit<Parameters<IntercompanyService['create']>[0], 'createdById'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.intercompany.create({ ...body, createdById: user.id });
  }

  @Get()
  @ApiOperation({ summary: 'List intercompany transactions, optionally filtered by entity (either side) or reconciliation status' })
  @RequirePermissions('intercompany.view')
  findAll(@Query('entityId') entityId?: string, @Query('status') status?: ReconciliationStatus) {
    return this.intercompany.findAll({ entityId, status });
  }

  @Post(':id/reconcile')
  @ApiOperation({
    summary: 'Reconcile an intercompany transaction pair',
    description:
      'Marks RECONCILED only if both the initiator\'s entry and its mirror are POSTED; otherwise marks PARTIALLY_RECONCILED. Rejected with a 400 if no mirror entry was ever recorded for this transaction.',
  })
  @RequirePermissions('intercompany.reconcile')
  reconcile(@Param('id') id: string) {
    return this.intercompany.reconcile(id);
  }

  @Post(':id/dispute')
  @ApiOperation({ summary: 'Flag an intercompany transaction as DISPUTED' })
  @RequirePermissions('intercompany.reconcile')
  dispute(@Param('id') id: string) {
    return this.intercompany.flagDisputed(id);
  }
}
