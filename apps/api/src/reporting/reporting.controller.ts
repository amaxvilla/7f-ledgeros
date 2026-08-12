import { BadRequestException, Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportingService } from './reporting.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SecurityContextService } from '../security/security-context.service';
import { UpsertIfrsNarrativeDisclosureDto } from './dto/upsert-ifrs-narrative-disclosure.dto';

@ApiTags('reporting')
@ApiBearerAuth()
@Controller('reporting')
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    private readonly securityContext: SecurityContextService,
  ) {}

  @Get('budget-vs-actual')
  @ApiOperation({ summary: 'Budget vs. actual report, by account', description: 'Reads vw_budget_vs_actual, entity-scoped and optionally narrowed to one fiscal year (omitting it returns every year on record).' })
  @RequirePermissions('budget.view')
  async budgetVsActual(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.budgetVsActual(scope, entityId, fiscalYear ? Number(fiscalYear) : undefined);
  }

  @Get('project-profitability')
  @ApiOperation({ summary: 'Project profitability report, ranked by profit amount', description: 'Reads vw_project_profitability for one entity, ordered highest-profit first.' })
  @RequirePermissions('budget.view')
  async projectProfitability(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.projectProfitability(scope, entityId);
  }

  @Get('vendor-aging')
  @ApiOperation({ summary: 'Vendor (AP) aging report', description: 'Reads vw_vendor_aging for one entity, ordered most-overdue first.' })
  @RequirePermissions('ap.view')
  async vendorAging(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.vendorAging(scope, entityId);
  }

  @Get('customer-aging')
  @ApiOperation({ summary: 'Customer (AR) aging report', description: 'Reads vw_customer_aging for one entity, ordered most-overdue first.' })
  @RequirePermissions('ar.view')
  async customerAging(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.customerAging(scope, entityId);
  }

  @Get('cash-forecast')
  @ApiOperation({ summary: 'Cash forecast report', description: 'Reads vw_cash_forecast for one entity, ordered by forecast horizon (days out) — cumulative, not a discrete per-day breakdown.' })
  @RequirePermissions('ap.view')
  async cashForecast(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.cashForecast(scope, entityId);
  }

  @Get('bank-reconciliation-summary')
  @ApiOperation({ summary: 'Bank reconciliation summary report', description: 'Reads vw_bank_reconciliation_summary for one entity.' })
  @RequirePermissions('bankrecon.view')
  async bankReconciliationSummary(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.bankReconciliationSummary(scope, entityId);
  }

  @Get('consolidated-trial-balance')
  @ApiOperation({ summary: 'Consolidated trial balance report', description: 'Reads vw_consolidated_trial_balance for one entity, ordered by account code.' })
  @RequirePermissions('budget.view')
  async consolidatedTrialBalance(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.consolidatedTrialBalance(scope, entityId);
  }

  // -- Phase 3A: IFRS & Statutory Financial Reporting --

  @Get('trial-balance')
  @ApiOperation({ summary: 'Statutory, period-scoped trial balance', description: 'Opening balance, period debit/credit movement, and closing balance per account (vw_trial_balance), for one entity and optionally one fiscal period. Omitting fiscalPeriodId returns every period on record, the basis for multi-period/comparative reporting.' })
  @RequirePermissions('gl.reports.view')
  async trialBalance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.trialBalance(scope, entityId, fiscalPeriodId);
  }

  @Get('general-ledger')
  @ApiOperation({ summary: 'Line-level general ledger report, with running balance', description: 'Reads vw_general_ledger, optionally narrowed to a single account and/or date range — backs both the whole-ledger "General Ledger Report" and the single-account "Account Ledger" deliverable from the same view/route.' })
  @RequirePermissions('gl.reports.view')
  async generalLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('accountId') accountId?: string,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.generalLedger(scope, entityId, { accountId, fiscalPeriodId, dateFrom, dateTo });
  }

  @Get('statement-of-profit-or-loss')
  @ApiOperation({ summary: 'IFRS Statement of Profit or Loss', description: 'A period flow, not a cumulative balance, for one entity and one fiscal period. Pass comparativeFiscalPeriodId for a prior-period comparative column alongside the current figures.' })
  @RequirePermissions('gl.reports.view')
  async statementOfProfitOrLoss(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('comparativeFiscalPeriodId') comparativeFiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.statementOfProfitOrLoss(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
  }

  @Get('statement-of-financial-position')
  @ApiOperation({ summary: 'IFRS Statement of Financial Position (balance sheet)', description: 'A point-in-time snapshot as at the end of one fiscal period. Includes a `balances` integrity check (assets vs. liabilities + equity) — this repo has no year-end close journal sweeping REVENUE/EXPENSE into Retained Earnings, so `balances` correctly reads false mid-year until a closing entry is posted; the ledger is reported as it stands, not plugged. Pass comparativeFiscalPeriodId for a prior-period comparative column.' })
  @RequirePermissions('gl.reports.view')
  async statementOfFinancialPosition(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('comparativeFiscalPeriodId') comparativeFiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.statementOfFinancialPosition(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
  }

  @Get('statement-of-cash-flows')
  @ApiOperation({ summary: 'IFRS Statement of Cash Flows', description: 'Supports both IAS 7 presentations via the optional method parameter: INDIRECT (default, reconciles net profit to net cash from operations) or DIRECT (reconstructs major operating cash receipt/payment lines). Both are built from the same period movements, so operatingActivities matches between them — confirmed by the response\'s own reconcilesToIndirect field when method=DIRECT, and reconcilesToLedger (opening + net change = closing) either way.' })
  @RequirePermissions('gl.reports.view')
  async statementOfCashFlows(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('method') method?: 'INDIRECT' | 'DIRECT',
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.statementOfCashFlows(scope, entityId, fiscalPeriodId, method);
  }

  @Get('financial-ratios')
  @ApiOperation({ summary: 'Financial ratios report', description: 'Reads vw_financial_ratios for one entity, optionally narrowed to one fiscal period (omitting it returns every period on record, ordered oldest first). Inventory/Receivables/Payables/Debt/D&A are recovered from account_category via a documented heuristic, not a dedicated schema tag — ratios inherit that same caveat.' })
  @RequirePermissions('gl.reports.view')
  async financialRatios(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.financialRatios(scope, entityId, fiscalPeriodId);
  }

  @Get('segment-reporting')
  @ApiOperation({ summary: 'Segment reporting, across six dimensions', description: 'Reads vw_segment_reporting for one entity/fiscal period, across Entity, Project, Department, Cost Centre, Funding Source, and Business Unit. Pass segmentType to narrow to one dimension (e.g. "PROJECT"); omitting it returns all six, distinguished by the segment_type column.' })
  @RequirePermissions('gl.reports.view')
  async segmentReporting(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('segmentType') segmentType?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.segmentReporting(scope, entityId, fiscalPeriodId, segmentType);
  }

  // -- Phase 3B: Remaining Statutory Financial Statements --

  @Get('statement-of-comprehensive-income')
  @ApiOperation({ summary: 'IFRS Statement of Comprehensive Income', description: 'Profit or Loss (reusing the same calculation as statement-of-profit-or-loss) plus Other Comprehensive Income, scoped to the two IAS 1 example items this schema can identify (Revaluation Reserve, Foreign Currency Translation Reserve movements). Other equity-reserve movements are deliberately excluded — this repo cannot distinguish genuine OCI from a transaction with owners in that catch-all bucket. Pass comparativeFiscalPeriodId for a prior-period comparative column.' })
  @RequirePermissions('gl.reports.view')
  async statementOfComprehensiveIncome(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('comparativeFiscalPeriodId') comparativeFiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.statementOfComprehensiveIncome(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
  }

  @Get('statement-of-changes-in-equity')
  @ApiOperation({ summary: 'IFRS Statement of Changes in Equity', description: 'Opening/movement/closing grid across six equity components, built from vw_statement_changes_in_equity so its own closing figures are guaranteed to tie back to the Balance Sheet\'s Equity section — the response\'s reconcilesToBalanceSheet field confirms this rather than assuming it. Pass comparativeFiscalPeriodId for a prior-period comparative column.' })
  @RequirePermissions('gl.reports.view')
  async statementOfChangesInEquity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('comparativeFiscalPeriodId') comparativeFiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.statementOfChangesInEquity(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
  }

  // -- Phase 3C: IFRS Notes to the Financial Statements --
  //
  // Route order matters here: 'ifrs-notes/export' and
  // 'ifrs-notes/multi-entity' are declared before the dynamic
  // 'ifrs-notes/:note' below so Nest's (Express-backed) router matches
  // them as their own static routes rather than ':note' greedily
  // capturing "export"/"multi-entity" as a note key.

  @Get('ifrs-notes')
  @ApiOperation({ summary: 'All 28 IFRS notes to the financial statements, for one entity/period', description: 'Combines GL-derived notes (e.g. property/plant/equipment, revenue breakdown) with narrative disclosure notes. Pass comparativeFiscalPeriodId to add a comparative column to every GL-derived note; narrative notes only ever reflect the current period\'s own disclosure text, since there is no meaningful comparative figure for free-text policy narrative.' })
  @RequirePermissions('gl.reports.view')
  async ifrsNotes(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('comparativeFiscalPeriodId') comparativeFiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.ifrsNotes(scope, entityId, fiscalPeriodId, comparativeFiscalPeriodId);
  }

  @Get('ifrs-notes/export')
  @ApiOperation({ summary: 'IFRS notes pack, reshaped for an export target', description: 'Same underlying data as ifrs-notes, reshaped by the required format parameter. "pdf-ready" returns the same nested/hierarchical shape as ifrs-notes as-is (matching how a statutory notes pack is actually organized). "excel-ready"/"powerbi" flatten it to one row per note/period/account — the shape both tools pivot well from. No PDF engine runs here; this returns structured data for a renderer to consume.' })
  @RequirePermissions('gl.reports.view')
  async ifrsNotesExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('format') format: string = 'pdf-ready',
    @Query('comparativeFiscalPeriodId') comparativeFiscalPeriodId?: string,
  ) {
    if (!['pdf-ready', 'excel-ready', 'powerbi'].includes(format)) {
      throw new BadRequestException(`format must be one of: pdf-ready, excel-ready, powerbi (got "${format}")`);
    }
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.ifrsNotesExport(
      scope,
      entityId,
      fiscalPeriodId,
      format as 'pdf-ready' | 'excel-ready' | 'powerbi',
      comparativeFiscalPeriodId,
    );
  }

  @Get('ifrs-notes/multi-entity')
  @ApiOperation({ summary: 'The full IFRS notes pack, for several entities at once', description: 'entityIds is a comma-separated list. Returns each requested entity\'s own unconsolidated notes — this deliberately does not attempt elimination/consolidation. Entities outside the caller\'s RLS scope are reported in the response\'s deniedEntityIds rather than failing the whole batch.' })
  @RequirePermissions('gl.reports.view')
  async ifrsNotesMultiEntity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityIds') entityIds: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('comparativeFiscalPeriodId') comparativeFiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    const ids = entityIds.split(',').map((id) => id.trim()).filter(Boolean);
    return this.reporting.ifrsNotesForEntities(scope, ids, fiscalPeriodId, comparativeFiscalPeriodId);
  }

  @Get('ifrs-notes/:note')
  @ApiOperation({ summary: 'One named IFRS note (e.g. "propertyPlantEquipment")', description: 'Returns a single note instead of the full 28-note pack, reusing the same ifrs-notes computation rather than a separate query — this is a reporting endpoint, not a hot path. Returns 404 for a note key not in the fixed, documented key list.' })
  @RequirePermissions('gl.reports.view')
  async ifrsNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('note') note: string,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Query('comparativeFiscalPeriodId') comparativeFiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.ifrsNote(scope, entityId, note, fiscalPeriodId, comparativeFiscalPeriodId);
  }

  @Put('ifrs-notes/:note/disclosure')
  @ApiOperation({ summary: 'Create or update one narrative note\'s disclosure text', description: 'Only applies to narrative-type notes (free-text policy disclosures), not GL-derived notes. Gated on gl.journal.post rather than a dedicated permission — editing a statutory disclosure is treated as warranting the same authority level as posting the ledger it accompanies. Returns 404 for a note key that isn\'t a narrative note.' })
  @RequirePermissions('gl.journal.post')
  async upsertIfrsNarrativeDisclosure(
    @CurrentUser() user: AuthenticatedUser,
    @Param('note') note: string,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
    @Body() dto: UpsertIfrsNarrativeDisclosureDto,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.upsertIfrsNarrativeDisclosure(
      scope,
      entityId,
      fiscalPeriodId,
      note as Parameters<ReportingService['upsertIfrsNarrativeDisclosure']>[3],
      dto.content,
      user.id,
    );
  }

  // -------------------------------------------------------------------
  // PHASE 5A — Real Estate Analytics (additive). Gated by the existing
  // 'realestate.view' permission — already granted to FINANCE_CONTROLLER
  // and VIEWER — rather than introducing a new permission for read-only
  // real estate reporting.
  // -------------------------------------------------------------------

  @Get('real-estate/sales-velocity')
  @ApiOperation({ summary: 'Real estate sales velocity report, by month', description: 'Reads vw_sales_velocity for one entity, optionally narrowed to one project, ordered most-recent month first.' })
  @RequirePermissions('realestate.view')
  async salesVelocity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('projectId') projectId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.salesVelocity(scope, entityId, projectId);
  }

  @Get('real-estate/inventory-ageing')
  @ApiOperation({ summary: 'Real estate inventory ageing report', description: 'Reads vw_inventory_ageing for one entity, optionally narrowed to one project, ordered oldest (most days on market) first.' })
  @RequirePermissions('realestate.view')
  async inventoryAgeing(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('projectId') projectId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.inventoryAgeing(scope, entityId, projectId);
  }

  @Get('real-estate/absorption-rate')
  @ApiOperation({ summary: 'Real estate absorption rate report, by month', description: 'Reads vw_absorption_rate for one entity, optionally narrowed to one project, ordered most-recent sale month first.' })
  @RequirePermissions('realestate.view')
  async absorptionRate(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('projectId') projectId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.absorptionRate(scope, entityId, projectId);
  }

  @Get('real-estate/unsold-units')
  @ApiOperation({ summary: 'Unsold real estate units dashboard', description: 'Reads vw_unsold_units_dashboard for one entity, ordered by highest total unsold value first (rows with a null total sort last).' })
  @RequirePermissions('realestate.view')
  async unsoldUnitsDashboard(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.unsoldUnitsDashboard(scope, entityId);
  }

  // -- Release: CRM Reporting Integration --

  @Get('crm-pipeline')
  @ApiOperation({ summary: 'CRM lead/prospect pipeline summary, RLS-scoped', description: 'Leads by status/source, conversion rate, average days open, and prospect pipeline value/win-rate for one entity. A deliberate second, RLS-scoped path onto the same CRM funnel the unscoped dashboard widget (/dashboard/crm-pipeline) already reads — added here rather than widening that existing endpoint\'s contract, to keep this an additive change.' })
  @RequirePermissions('crm.view')
  async crmPipeline(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.crmPipeline(scope, entityId);
  }

  // -- Release: Fixed Asset Reporting Integration --

  @Get('fixed-asset-register')
  @ApiOperation({ summary: 'Statutory-grade fixed asset register, by category', description: 'Every fixed asset for one entity with cost, accumulated depreciation, and net book value as of the latest posted month, grouped by category with category and grand totals. A heavier, statutory-grade companion to the lighter Dashboard fixed-asset summary widget — not a replacement for it.' })
  @RequirePermissions('fixedasset.view')
  async fixedAssetRegister(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.fixedAssetRegister(scope, entityId);
  }

  // -- Release K: PMO Reporting Integration --

  @Get('pmo-project-performance')
  @ApiOperation({ summary: 'Project schedule (Gantt) plus earned-value metrics, for one project', description: 'Combines a Gantt-shaped schedule with earned value figures (PV/EV/AC/SV/CV/SPI/CPI) by calling the existing scheduling service directly rather than duplicating its logic. Does not recompute or persist the project\'s own critical path — that has a side effect (flagging ProjectTask.isCritical/totalFloatDays) not appropriate for a read-only report.' })
  @RequirePermissions('pmo.view')
  async pmoProjectPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('projectId') projectId: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.pmoProjectPerformance(scope, entityId, projectId);
  }

  @Get('pmo-risk-issue-register')
  @ApiOperation({ summary: 'Risk/issue register summary', description: 'Reads the existing risk/issue summary service, entity-scoped and optionally narrowed to one project; omitting projectId summarizes across every project in the entity.' })
  @RequirePermissions('pmo.view')
  async pmoRiskIssueRegister(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('projectId') projectId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.pmoRiskIssueRegister(scope, entityId, projectId);
  }

  @Get('integrations-overview')
  @ApiOperation({ summary: 'Every configured integration provider, worst-health-first', description: 'Reads vw_integrations_overview, optionally narrowed to one entity (most providers have a null entityId — system-wide configuration). Not RLS-scoped by entity access the way every other route on this controller is: access here is gated entirely by the integrations.view permission, since integration providers are configuration, not entity-scoped transactional data.' })
  @RequirePermissions('integrations.view')
  integrationsOverview(@Query('entityId') entityId?: string) {
    return this.reporting.integrationsOverview(entityId);
  }

  @Get('payment-transactions-register')
  @ApiOperation({ summary: 'Payment transactions register, with refunds netted out', description: 'Reads vw_payment_transactions_register for one entity, optionally narrowed to one status, ordered most-recent first. Per-transaction detail complementing the per-status dashboard summary elsewhere.' })
  @RequirePermissions('payments.view')
  async paymentTransactionsRegister(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('status') status?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.paymentTransactionsRegister(scope, entityId, status);
  }

  @Get('mono-linked-accounts-register')
  @ApiOperation({ summary: 'Bank-linked accounts register (Mono), every status', description: 'Reads vw_mono_linked_accounts_register for one entity, optionally narrowed to one status, ordered most-recently-linked first. Per-linked-account detail across every status (not just ACTIVE/REQUIRES_REAUTH), complementing the dashboard summary elsewhere.' })
  @RequirePermissions('bank_link.view')
  async monoLinkedAccountsRegister(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('status') status?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.reporting.monoLinkedAccountsRegister(scope, entityId, status);
  }
}
