import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsolidationService } from './consolidation.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/**
 * Multi-entity consolidation: parent/subsidiary groups, ownership
 * percentages, and a consolidated trial balance/P&L/balance sheet
 * derived from it. Confirmed directly against `ConsolidationService`:
 * the P&L and balance sheet routes both derive from the SAME trial
 * balance call underneath (`getConsolidatedTrialBalance`), just
 * filtered/summed differently by account type — not three independent
 * computations. Minority (non-controlling) interest is explicitly a
 * SIMPLIFIED calculation (the service's own comment says so): it
 * distributes the group's total net income evenly across subsidiaries
 * before applying each one's own minority percentage, rather than
 * attributing income per-subsidiary — stated in the P&L route's own
 * description, not left for a reader to discover only by reading the
 * service.
 */
@ApiTags('consolidation')
@ApiBearerAuth()
@Controller('consolidation')
export class ConsolidationController {
  constructor(private readonly consolidation: ConsolidationService) {}

  @Post('groups')
  @RequirePermissions('consolidation.manage')
  @ApiOperation({ summary: 'Create a consolidation group', description: 'Rejected if the code is already used, or if parentEntityId does not reference a real entity.' })
  createGroup(@Body() body: { code: string; name: string; parentEntityId: string }) {
    return this.consolidation.createGroup(body);
  }

  @Get('groups')
  @RequirePermissions('consolidation.view')
  @ApiOperation({ summary: 'List consolidation groups', description: 'Includes each group\'s own ownership rows.' })
  findGroups() {
    return this.consolidation.findGroups();
  }

  @Post('ownerships')
  @RequirePermissions('consolidation.manage')
  @ApiOperation({
    summary: 'Record an ownership stake between a parent and child entity within a group',
    description: 'ownershipPercent must be between 0 and 100 (exclusive of 0). effectiveTo is optional — an open-ended stake.',
  })
  setOwnership(
    @Body()
    body: {
      consolidationGroupId: string;
      parentEntityId: string;
      childEntityId: string;
      ownershipPercent: number;
      effectiveFrom: string;
      effectiveTo?: string;
    },
  ) {
    return this.consolidation.setOwnership(body);
  }

  @Get('groups/:id/trial-balance')
  @RequirePermissions('consolidation.view')
  @ApiOperation({
    summary: 'Consolidated trial balance for a group',
    description: 'Sums posted journal lines by account across every member entity (the parent plus every child ownership), then nets out this group\'s own recorded intercompany eliminations against the gross totals — eliminations are subtracted in aggregate, not matched back to individual accounts. Optionally scoped to one fiscal period.',
  })
  trialBalance(@Param('id') id: string, @Query('fiscalPeriodId') fiscalPeriodId?: string) {
    return this.consolidation.getConsolidatedTrialBalance(id, fiscalPeriodId);
  }

  @Get('groups/:id/profit-and-loss')
  @RequirePermissions('consolidation.view')
  @ApiOperation({
    summary: 'Consolidated profit & loss for a group',
    description: 'Derived from the same consolidated trial balance the trial-balance route returns, filtered to revenue/expense accounts. Minority interest is a SIMPLIFIED calculation: the group\'s total net income is distributed evenly across subsidiaries before applying each one\'s own minority percentage, not attributed per-subsidiary from its own actual results — a stated, real limitation, not full statutory minority-interest accounting.',
  })
  profitAndLoss(@Param('id') id: string, @Query('fiscalPeriodId') fiscalPeriodId?: string) {
    return this.consolidation.getConsolidatedProfitAndLoss(id, fiscalPeriodId);
  }

  @Get('groups/:id/balance-sheet')
  @RequirePermissions('consolidation.view')
  @ApiOperation({
    summary: 'Consolidated balance sheet for a group',
    description: 'Also derived from the same consolidated trial balance, filtered to asset/liability/equity accounts. Includes a `balances` boolean (assets vs. liabilities+equity, within a small rounding tolerance) as a self-check on the result.',
  })
  balanceSheet(@Param('id') id: string, @Query('fiscalPeriodId') fiscalPeriodId?: string) {
    return this.consolidation.getConsolidatedBalanceSheet(id, fiscalPeriodId);
  }
}
