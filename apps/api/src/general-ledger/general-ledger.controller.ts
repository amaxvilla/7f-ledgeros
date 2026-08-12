import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PostingEngineService } from './posting-engine.service';
import { GeneralLedgerQueryService } from './general-ledger-query.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';

@ApiTags('general-ledger')
@ApiBearerAuth()
@Controller('gl')
export class GeneralLedgerController {
  constructor(
    private readonly postingEngine: PostingEngineService,
    private readonly queryService: GeneralLedgerQueryService,
  ) {}

  // Release O — Entity-Level Security: this is the exact endpoint the
  // RlsBodyCheck decorator's own docblock cites as its usage example, but
  // it was never actually applied here — any user holding gl.journal.create
  // could previously post a journal entry against ANY entity, not just
  // ones their RLS grants cover. No other behavior changed.
  @Post('journal-entries')
  @ApiOperation({
    summary: 'Create a draft journal entry',
    description: 'Entity-scoped by RLS on entityId. The entry starts DRAFT and must go through submit → approve → post before it affects the ledger.',
  })
  @RequirePermissions('gl.journal.create')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  createDraft(@Body() dto: CreateJournalEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.postingEngine.createDraft(dto, user.id);
  }

  @Get('journal-entries')
  @ApiOperation({ summary: 'List journal entries', description: 'Filterable by entityId, status, and fiscalPeriodId; all optional.' })
  @RequirePermissions('gl.journal.view')
  findAll(
    @Query('entityId') entityId?: string,
    @Query('status') status?: string,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
  ) {
    return this.queryService.findAll({ entityId, status, fiscalPeriodId });
  }

  @Get('journal-entries/:id')
  @ApiOperation({ summary: 'Get a journal entry by id' })
  @RequirePermissions('gl.journal.view')
  findOne(@Param('id') id: string) {
    return this.queryService.findOne(id);
  }

  @Post('journal-entries/:id/submit')
  @ApiOperation({ summary: 'Submit a draft journal entry for approval', description: 'Only valid from DRAFT; moves the entry to PENDING_APPROVAL.' })
  @RequirePermissions('gl.journal.create')
  submit(@Param('id') id: string) {
    return this.postingEngine.submitForApproval(id);
  }

  @Post('journal-entries/:id/approve')
  @ApiOperation({
    summary: 'Approve a pending journal entry',
    description: 'Only valid from PENDING_APPROVAL. The preparer of the entry cannot also approve it — enforced server-side, rejected with a 400 otherwise.',
  })
  @RequirePermissions('gl.journal.approve')
  approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postingEngine.approve(id, user.id);
  }

  @Post('journal-entries/:id/reject')
  @ApiOperation({ summary: 'Reject a pending journal entry', description: 'Only valid from PENDING_APPROVAL.' })
  @RequirePermissions('gl.journal.approve')
  reject(@Param('id') id: string) {
    return this.postingEngine.reject(id);
  }

  @Post('journal-entries/:id/post')
  @ApiOperation({
    summary: 'Post an approved journal entry to the ledger',
    description: 'Only valid from APPROVED. Enforces balanced debits/credits and an open fiscal period inside one DB transaction; assigns the gap-free journal number.',
  })
  @RequirePermissions('gl.journal.post')
  post(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postingEngine.post(id, user.id);
  }

  @Post('journal-entries/:id/reverse')
  @ApiOperation({
    summary: 'Reverse a posted journal entry',
    description:
      'Only valid from POSTED. Creates a new, separate, auto-approved journal entry dated today (SYSTEM_REVERSAL, linked via reversalOfId) rather than mutating the original — the original stays in the ledger as posted history.',
  })
  @RequirePermissions('gl.journal.post')
  reverse(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.postingEngine.reverse(id, user.id, body?.reason);
  }

  @Post('periods/:id/lock')
  @ApiOperation({
    summary: 'Lock a fiscal period against further posting',
    description: 'Rejected with a 409 if any journal entry in the period is still DRAFT, PENDING_APPROVAL, or APPROVED-but-not-posted — every entry must be POSTED or REJECTED first.',
  })
  @RequirePermissions('gl.period.lock')
  lockPeriod(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.postingEngine.lockPeriod(id, user.id);
  }

  @Get('trial-balance')
  @ApiOperation({ summary: 'Get the trial balance for an entity', description: 'fiscalPeriodId is optional; omitting it returns the balance as of the current period.' })
  @RequirePermissions('gl.reports.view')
  trialBalance(@Query('entityId') entityId: string, @Query('fiscalPeriodId') fiscalPeriodId?: string) {
    return this.queryService.getTrialBalance(entityId, fiscalPeriodId);
  }
}
