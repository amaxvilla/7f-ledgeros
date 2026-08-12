import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BankReconciliationService } from './bank-reconciliation.service';
import { ImportBankStatementDto } from './dto/import-bank-statement.dto';
import { CreateReconciliationSessionDto } from './dto/create-reconciliation-session.dto';
import { ManualMatchDto } from './dto/manual-match.dto';
import { RecordAdjustmentDto } from './dto/record-adjustment.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';

@ApiTags('bank-reconciliation')
@ApiBearerAuth()
@Controller('bank-reconciliation')
export class BankReconciliationController {
  constructor(private readonly bankRecon: BankReconciliationService) {}

  // Release O — Entity-Level Security: previously any bankrecon.manage
  // holder could import a statement or open a session against any entity.
  @Post('import')
  @RequirePermissions('bankrecon.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Import a bank statement', description: 'Rejected if the bank account does not exist or is inactive. Creates the statement together with all of its lines in one call.' })
  importStatement(@Body() dto: ImportBankStatementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bankRecon.importStatement(dto, user.id);
  }

  @Get('statements/:id')
  @RequirePermissions('bankrecon.view')
  @ApiOperation({ summary: 'Get an imported bank statement with its lines' })
  findStatement(@Param('id') id: string) {
    return this.bankRecon.findStatement(id);
  }

  @Post('sessions')
  @RequirePermissions('bankrecon.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Open a reconciliation session for an imported statement', description: 'Starts in DRAFT status. Rejected if the statement does not belong to the given entity/bank account.' })
  createSession(@Body() dto: CreateReconciliationSessionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bankRecon.createSession(dto, user.id);
  }

  @Get('sessions/:id')
  @RequirePermissions('bankrecon.view')
  @ApiOperation({ summary: 'Get a reconciliation session' })
  findSession(@Param('id') id: string) {
    return this.bankRecon.findSession(id);
  }

  @Get('sessions/:id/summary')
  @RequirePermissions('bankrecon.view')
  @ApiOperation({
    summary: "Get a session's reconciliation summary",
    description: 'Two-sided: statement lines not yet matched, AND posted journal lines on the bank GL account (within the statement period) not yet matched to any statement line — the book side of the reconciliation gap, not just the bank side.',
  })
  getSessionSummary(@Param('id') id: string) {
    return this.bankRecon.getSessionSummary(id);
  }

  @Post('sessions/:id/auto-match')
  @RequirePermissions('bankrecon.manage')
  @ApiOperation({
    summary: 'Auto-match unmatched statement lines against posted journal lines',
    description: "Matches each unmatched statement line to an available posted journal line on the session's bank GL account, by amount (within 0.01) and transaction/entry date (within 5 days), using debit for a deposit / credit for a withdrawal. Each journal line can satisfy at most one match. Returns the count matched and remaining unmatched — does not throw if some lines find no match.",
  })
  autoMatch(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bankRecon.autoMatch(id, user.id);
  }

  @Post('sessions/:id/manual-match')
  @RequirePermissions('bankrecon.manage')
  @ApiOperation({ summary: 'Manually match one statement line to one journal line', description: 'Rejected if the session is not DRAFT, the statement line does not belong to this session, or the statement line is already matched.' })
  manualMatch(@Param('id') id: string, @Body() dto: ManualMatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bankRecon.manualMatch(id, dto, user.id);
  }

  @Post('sessions/:id/adjustments')
  @RequirePermissions('bankrecon.manage')
  @ApiOperation({
    summary: 'Record a book adjustment for an unmatched statement line',
    description: 'Used for bank-side-only items with no corresponding journal line (e.g. bank charges, interest income) rather than matching. INTEREST_INCOME is only valid against a deposit (positive) line; BANK_CHARGE is only valid against a withdrawal (negative) line — rejected otherwise.',
  })
  recordAdjustment(@Param('id') id: string, @Body() dto: RecordAdjustmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.bankRecon.recordAdjustment(id, dto, user.id);
  }

  @Post('sessions/:id/approve')
  @RequirePermissions('bankrecon.approve')
  @ApiOperation({
    summary: 'Approve a reconciliation session',
    description: 'Rejected if any statement line is still unmatched (every line must be matched or adjusted first), or if the caller is the same user who created the session.',
  })
  approveSession(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.bankRecon.approveSession(id, user.id);
  }
}
