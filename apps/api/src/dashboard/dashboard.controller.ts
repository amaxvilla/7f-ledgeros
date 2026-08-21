import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SecurityContextService } from '../security/security-context.service';
import { MaskFields } from '../security/decorators/mask-fields.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // Phase 5A — Real Estate Analytics (additive). See DashboardService's
  // doc comment on getRealEstateAnalyticsOverview for why this one
  // endpoint builds a SecurityScope and the others on this controller
  // don't.
  @Get('real-estate-analytics')
  @ApiOperation({ summary: 'Real Estate dashboard widget: sales velocity, inventory ageing, absorption rate, unsold units', description: 'Bundles four separate ReportingService calls into one response. Entity-scoped by RLS (this route builds a SecurityScope, unlike most of this controller\'s other routes) since ReportingService enforces it.' })
  @RequirePermissions('realestate.view')
  async getRealEstateAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('projectId') projectId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.dashboard.getRealEstateAnalyticsOverview(scope, entityId, projectId);
  }

  // Release — CRM Reporting Integration (additive). Builds a SecurityScope
  // for the same reason 'real-estate-analytics' above does: it goes
  // through ReportingService, which enforces entity-level RLS. This is a
  // separate endpoint from 'crm-pipeline' below, not a replacement for
  // it — see DashboardService.getCrmAnalyticsOverview's doc comment.
  @Get('crm-analytics')
  @ApiOperation({ summary: 'CRM dashboard widget: pipeline analytics via ReportingService', description: 'A separate endpoint from GET dashboard/crm-pipeline below, not a replacement for it — this one goes through ReportingService (RLS-enforced, hence the SecurityScope this route builds), crm-pipeline goes through CrmService directly.' })
  @RequirePermissions('crm.view')
  async getCrmAnalytics(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.dashboard.getCrmAnalyticsOverview(scope, entityId);
  }

  // Release F — Notifications API (additive). Self-service, like
  // /auth/sessions — no special permission needed.
  @Get('my-notifications')
  @ApiOperation({ summary: 'Get the caller\'s own notifications widget', description: 'Self-service — resolves from the authenticated caller\'s own userId, no permission check beyond being logged in, the same self-service shape /auth/sessions uses.' })
  getMyNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getMyNotificationsWidget(user.id);
  }

  @Get('budget-vs-actual')
  @ApiOperation({ summary: 'Budget-vs-actual dashboard widget', description: 'Calls the exact same DashboardService.getBudgetOverview as GET dashboard/committed-vs-available below — the two routes currently return identical data under different names, not two different views.' })
  @RequirePermissions('budget.view')
  getBudgetVsActual(@Query('entityId') entityId: string, @Query('fiscalYear') fiscalYear?: string) {
    return this.dashboard.getBudgetOverview(entityId, fiscalYear ? Number(fiscalYear) : undefined);
  }

  @Get('committed-vs-available')
  @ApiOperation({ summary: 'Committed-vs-available dashboard widget', description: 'Calls the exact same DashboardService.getBudgetOverview as GET dashboard/budget-vs-actual above — currently identical data under a different name, not a distinct view.' })
  @RequirePermissions('budget.view')
  getCommittedVsAvailable(@Query('entityId') entityId: string, @Query('fiscalYear') fiscalYear?: string) {
    return this.dashboard.getBudgetOverview(entityId, fiscalYear ? Number(fiscalYear) : undefined);
  }

  @Get('outstanding-payables-receivables')
  @ApiOperation({ summary: 'Outstanding AP/AR dashboard widget for an entity' })
  @RequirePermissions('ap.view')
  getOutstandingPayablesReceivables(@Query('entityId') entityId: string) {
    return this.dashboard.getOutstandingPayablesReceivables(entityId);
  }

  @Get('cash-forecast')
  @ApiOperation({ summary: 'Cash forecast dashboard widget for an entity' })
  @RequirePermissions('ap.view')
  getCashForecast(@Query('entityId') entityId: string) {
    return this.dashboard.getCashForecast(entityId);
  }

  @Get('loan-exposure')
  @ApiOperation({ summary: 'Loan/borrowing exposure dashboard widget for an entity' })
  @RequirePermissions('treasury.view')
  @MaskFields({ group: 'loanValues', fields: ['totalOutstanding', 'facilityAmount', 'drawn', 'principalRepaid', 'outstanding'] })
  getLoanExposure(@Query('entityId') entityId: string) {
    return this.dashboard.getLoanExposure(entityId);
  }

  @Get('crm-pipeline')
  @ApiOperation({ summary: 'CRM pipeline dashboard widget via CrmService directly', description: 'Pre-existing, unscoped CrmService call — unlike GET dashboard/crm-analytics above, this route\'s underlying call is not RLS-scoped by a SecurityScope even when entityId is supplied. A separate endpoint from crm-analytics, not a replacement for it — see that route\'s own description.' })
  @RequirePermissions('crm.view')
  getCrmPipeline(@Query('entityId') entityId?: string) {
    return this.dashboard.getCrmPipelineOverview(entityId);
  }

  // RE-COMM.6 — Commission dashboard widget (additive). Builds a
  // SecurityScope for the same reason 'real-estate-analytics'/
  // 'crm-analytics' above do: CommissionReportingService.getSummary is
  // RLS-scoped (buildWhere over entity/businessUnit dimensions), same as
  // every other CommissionReporting* route already requires.
  @Get('commission-overview')
  @ApiOperation({ summary: 'Commission dashboard widget: earned/approved/payable/paid/outstanding via CommissionReportingService', description: 'Pure delegation to CommissionReportingService.getSummary (RE-COMM.5) — no new aggregation query, RLS-scoped by entity/businessUnit exactly as every other commission-reporting route already is.' })
  @RequirePermissions('commission.view')
  async getCommissionOverview(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId?: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.dashboard.getCommissionOverview(scope, entityId);
  }

  @Get('snag-overview')
  @ApiOperation({ summary: 'Snag-list dashboard widget', description: 'No entityId parameter at all — reuses HandoverService\'s own aggregation, which is not entity-filterable through this route.' })
  @RequirePermissions('handover.view')
  getSnagOverview() {
    return this.dashboard.getSnagOverview();
  }

  @Get('mortgage-exposure')
  @ApiOperation({ summary: 'Mortgage pipeline exposure dashboard widget', description: 'Reuses MortgageService\'s own aggregation rather than re-querying here. entityId is optional.' })
  @RequirePermissions('mortgage.view')
  getMortgageExposure(@Query('entityId') entityId?: string) {
    return this.dashboard.getMortgageExposure(entityId);
  }

  @Get('lease-overview')
  @ApiOperation({ summary: 'Lease / rent-roll dashboard widget', description: 'Reuses LeaseService\'s own aggregation rather than re-querying here. entityId is optional.' })
  @RequirePermissions('lease.view')
  getLeaseOverview(@Query('entityId') entityId?: string) {
    return this.dashboard.getLeaseOverview(entityId);
  }

  @Get('maintenance-overview')
  @ApiOperation({ summary: 'Facility Management maintenance-requests dashboard widget', description: 'Reuses FacilityService\'s own aggregation rather than re-querying here. entityId is optional.' })
  @RequirePermissions('maintenance.view')
  getMaintenanceOverview(@Query('entityId') entityId?: string) {
    return this.dashboard.getMaintenanceOverview(entityId);
  }

  @Get('fixed-asset-overview')
  @ApiOperation({ summary: 'Fixed asset register dashboard widget', description: 'Status mix, category count, and total net book value. Reuses FixedAssetsService\'s own aggregation rather than re-querying here. entityId is optional.' })
  @RequirePermissions('fixedasset.view')
  getFixedAssetOverview(@Query('entityId') entityId?: string) {
    return this.dashboard.getFixedAssetOverview(entityId);
  }

  @Get('tax-overview')
  @ApiOperation({ summary: 'Pending WHT/VAT dashboard widget for an entity' })
  @RequirePermissions('tax.view')
  getTaxOverview(@Query('entityId') entityId: string) {
    return this.dashboard.getTaxOverview(entityId);
  }

  @Get('executive-summary')
  @ApiOperation({
    summary: 'Executive dashboard summary: P&L, ratios, budget, AP/AR, cash, fixed assets, tax, and top-variance projects, bundled',
    description: 'Entity-scoped by RLS (builds a SecurityScope, same as real-estate-analytics/crm-analytics above). Profit & loss is only included when fiscalPeriodId is given — omitted, that one field is null while every other field in the bundle is still returned.',
  })
  @RequirePermissions('executive.view')
  async getExecutiveSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('fiscalPeriodId') fiscalPeriodId?: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.dashboard.getExecutiveSummary(scope, entityId, fiscalPeriodId);
  }

  @Get('bank-reconciliation-status')
  @ApiOperation({
    summary: 'Bank reconciliation status dashboard widget',
    description: 'One row per active bank account of the entity, each showing its own latest ReconciliationSession (by sessionDate) and that session\'s statement lines. An account with no session yet still gets a row.',
  })
  @RequirePermissions('bankrecon.view')
  getBankReconciliationStatus(@Query('entityId') entityId: string) {
    return this.dashboard.getBankReconciliationStatus(entityId);
  }

  @Get('top-projects-by-variance')
  @ApiOperation({
    summary: 'Top projects by budget variance',
    description: 'Only considers budget lines whose own budget is APPROVED — DRAFT/SUBMITTED/REJECTED budgets are excluded. limit defaults to 5.',
  })
  @RequirePermissions('budget.view')
  getTopProjectsByVariance(@Query('entityId') entityId: string, @Query('limit') limit?: string) {
    return this.dashboard.getTopProjectsByVariance(entityId, limit ? Number(limit) : 5);
  }

  @Get('project-schedule-overview')
  @ApiOperation({ summary: 'Project schedule dashboard widget', description: 'asOfDate is optional; omitting it evaluates the schedule as of now.' })
  @RequirePermissions('pmo.view')
  getProjectScheduleOverview(@Query('projectId') projectId: string, @Query('asOfDate') asOfDate?: string) {
    return this.dashboard.getProjectScheduleOverview(projectId, asOfDate);
  }

  @Get('pmo-risk-issue-overview')
  @ApiOperation({ summary: 'PMO risk/issue counts dashboard widget', description: 'projectId is optional — omitting it returns the overview across every project the caller\'s RLS scope permits.' })
  @RequirePermissions('pmo.view')
  getPmoRiskIssueOverview(@Query('projectId') projectId?: string) {
    return this.dashboard.getPmoRiskIssueOverview(projectId);
  }

  @Get('resource-utilization-overview')
  @ApiOperation({ summary: 'PMO resource utilization dashboard widget for a project' })
  @RequirePermissions('pmo.view')
  getResourceUtilizationOverview(@Query('projectId') projectId: string) {
    return this.dashboard.getResourceUtilizationOverview(projectId);
  }

  @Get('security-overview')
  @ApiOperation({
    summary: 'Account lockout security dashboard widget',
    description: 'Currently-locked accounts plus trailing failed-login/lockout counts, reusing AccountLockoutService\'s own aggregation. sinceHours defaults to 24.',
  })
  @RequirePermissions('security.access.view')
  getSecurityOverview(@Query('sinceHours') sinceHours?: string) {
    return this.dashboard.getSecurityOverview(sinceHours ? Number(sinceHours) : undefined);
  }

  @Get('mfa-adoption-overview')
  @ApiOperation({ summary: 'MFA adoption dashboard widget', description: 'Reuses MfaService\'s own aggregation rather than re-querying here. No parameters.' })
  @RequirePermissions('security.access.view')
  getMfaAdoptionOverview() {
    return this.dashboard.getMfaAdoptionOverview();
  }

  // Release N — Session Management widget.
  @Get('session-security-overview')
  @ApiOperation({ summary: 'Active session count dashboard widget', description: 'Reuses SessionService\'s own aggregation rather than re-querying here. No parameters.' })
  @RequirePermissions('security.access.view')
  getSessionSecurityOverview() {
    return this.dashboard.getSessionSecurityOverview();
  }

  // Release P — IP Restrictions widget.
  @Get('ip-restriction-overview')
  @ApiOperation({
    summary: 'IP restriction rules dashboard widget',
    description: 'Counts of active GLOBAL-scope vs. active USER-scope IP restriction rules, plus the total rule count (active and inactive) — so an admin can see at a glance whether the feature is in use at all.',
  })
  @RequirePermissions('security.access.view')
  getIpRestrictionOverview() {
    return this.dashboard.getIpRestrictionOverview();
  }

  // Release K — PMO Reporting Integration (additive). Builds a
  // SecurityScope for the same reason 'real-estate-analytics' and
  // 'crm-analytics' above do — it goes through ReportingService, which
  // enforces entity-level RLS. See DashboardService.getPmoAnalyticsOverview's
  // doc comment for why this is a separate endpoint from
  // 'project-schedule-overview' / 'pmo-risk-issue-overview' above, not a
  // replacement for either.
  @Get('pmo-analytics')
  @ApiOperation({
    summary: 'PMO analytics dashboard widget via ReportingService',
    description: 'A separate endpoint from project-schedule-overview/pmo-risk-issue-overview above, not a replacement for either — this one goes through ReportingService (RLS-enforced, hence the SecurityScope this route builds, the same reason real-estate-analytics/crm-analytics build one).',
  })
  @RequirePermissions('pmo.view')
  async getPmoAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('entityId') entityId: string,
    @Query('projectId') projectId: string,
  ) {
    const scope = await this.securityContext.buildScope(user);
    return this.dashboard.getPmoAnalyticsOverview(scope, entityId, projectId);
  }

  // Release IA — Integrations health widget: counts of configured
  // providers by status/category, reusing IntegrationsService's own
  // aggregation. No SecurityScope needed — integration providers are
  // system-wide config, not RLS-scoped transactional data.
  @Get('integrations-health-overview')
  @ApiOperation({ summary: 'Integrations health dashboard widget', description: 'Reuses IntegrationsService\'s own aggregation rather than re-querying here. No parameters.' })
  @RequirePermissions('integrations.view')
  getIntegrationsHealthOverview() {
    return this.dashboard.getIntegrationsHealthOverview();
  }

  // Release IE.1, Checkpoint G — Payment Framework dashboard integration.
  // Builds a SecurityScope for the same reason 'crm-analytics' and
  // 'pmo-analytics' above do: PaymentsService.getOverview enforces
  // entity-level RLS (assertEntityAccess), same as ReportingService does
  // for those.
  @Get('payments-overview')
  @ApiOperation({ summary: 'Payment Framework dashboard widget for an entity', description: 'Delegates to PaymentsService.getOverview, which enforces entity-level RLS itself (assertEntityAccess) — this route builds a SecurityScope for that reason, the same as crm-analytics/pmo-analytics above.' })
  @RequirePermissions('payments.view')
  async getPaymentsOverview(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.dashboard.getPaymentsOverview(scope, entityId);
  }

  // Release IF.1, Checkpoint I — Bank Integration dashboard integration.
  // Builds a SecurityScope for the same reason 'payments-overview' above
  // does: MonoLinkedAccountService.getOverview enforces entity-level RLS
  // itself.
  @Get('mono-linked-accounts-overview')
  @ApiOperation({ summary: 'Bank-linked-accounts dashboard widget for an entity', description: 'Per-status counts plus reauth-needed and stale-sync lists. Delegates to MonoLinkedAccountService.getOverview, which enforces entity-level RLS itself — same reason payments-overview above builds a SecurityScope.' })
  @RequirePermissions('bank_link.view')
  async getMonoLinkedAccountsOverview(@CurrentUser() user: AuthenticatedUser, @Query('entityId') entityId: string) {
    const scope = await this.securityContext.buildScope(user);
    return this.dashboard.getMonoLinkedAccountsOverview(scope, entityId);
  }

  // Release IG.1, Checkpoint D — recruitment "needs attention" widget.
  // No SecurityScope build here, unlike 'payments-overview'/
  // 'mono-linked-accounts-overview' above — DashboardService.getRecruitmentCalendarSyncFailures
  // doesn't take one, matching InterviewService.findWithFailedCalendarSync's
  // own signature (see that method's doc comment).
  @Get('recruitment-calendar-sync-failures')
  @ApiOperation({ summary: 'Recruitment \'needs attention\' widget: interviews with a failed calendar sync', description: 'Reuses InterviewService\'s own findWithFailedCalendarSync query. Not RLS-scoped by a SecurityScope, matching that method\'s own signature. entityId is optional.' })
  @RequirePermissions('recruitment.view')
  getRecruitmentCalendarSyncFailures(@Query('entityId') entityId?: string) {
    return this.dashboard.getRecruitmentCalendarSyncFailures(entityId);
  }

  // Release IG.1, Checkpoint I — contact-sync half of the same
  // "needs attention" widget the calendar-sync-failures endpoint above
  // covers. Same no-SecurityScope reasoning.
  @Get('recruitment-contact-sync-failures')
  @ApiOperation({ summary: 'Recruitment \'needs attention\' widget: candidates with a failed Outlook contact sync', description: 'Contact-sync half of the same widget as recruitment-calendar-sync-failures above. Reuses CandidateService\'s own findWithFailedContactSync query, same not-RLS-scoped shape. entityId is optional.' })
  @RequirePermissions('recruitment.view')
  getRecruitmentContactSyncFailures(@Query('entityId') entityId?: string) {
    return this.dashboard.getRecruitmentContactSyncFailures(entityId);
  }

  // Release IG.1, Checkpoint U — Teams-sync half of the same "needs
  // attention" widget. Same no-SecurityScope reasoning as its two
  // siblings above.
  @Get('recruitment-teams-sync-failures')
  @ApiOperation({ summary: 'Recruitment \'needs attention\' widget: interviews with a failed Teams sync', description: 'Teams-sync half of the same widget as recruitment-calendar-sync-failures above. Reuses InterviewService\'s own findWithFailedTeamsSync query, same not-RLS-scoped shape. entityId is optional.' })
  @RequirePermissions('recruitment.view')
  getRecruitmentTeamsSyncFailures(@Query('entityId') entityId?: string) {
    return this.dashboard.getRecruitmentTeamsSyncFailures(entityId);
  }

  // Digital Signature Providers, Checkpoint D — signature-sync half of
  // the same "needs attention" widget. No entityId query param, unlike
  // its three siblings above — DashboardService.getRecruitmentSignatureSyncFailures
  // itself takes none (see that method's own doc comment for why).
  @Get('recruitment-signature-sync-failures')
  @ApiOperation({ summary: 'Recruitment \'needs attention\' widget: offers with a failed e-signature envelope sync', description: 'Signature-sync half of the same widget as its three siblings above. Reuses OfferService\'s own findWithFailedSignatureSync query. No entityId parameter at all, unlike its siblings — the offers table has no direct entityId column (it hangs off jobApplication -> vacancy -> entityId instead), so this takes nothing rather than silently accepting and dropping a filter that would look like it works.' })
  @RequirePermissions('recruitment.view')
  getRecruitmentSignatureSyncFailures() {
    return this.dashboard.getRecruitmentSignatureSyncFailures();
  }
}
