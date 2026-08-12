import { Injectable } from '@nestjs/common';
import { BudgetStatus, LoanStatus, ReconciliationSessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetingService } from '../budgeting/budgeting.service';
import { AccountsPayableService } from '../accounts-payable/accounts-payable.service';
import { AccountsReceivableService } from '../accounts-receivable/accounts-receivable.service';
import { CrmService } from '../crm/crm.service';
import { HandoverService } from '../handover/handover.service';
import { MortgageService } from '../mortgage/mortgage.service';
import { LeaseService } from '../lease/lease.service';
import { FacilityService } from '../facility/facility.service';
import { ReportingService } from '../reporting/reporting.service';
import { SecurityScope } from '../security/security.types';
import { NotificationsService } from '../notifications/notifications.service';
import { FixedAssetsService } from '../fixed-assets/fixed-assets.service';
import { TaxService } from '../tax/tax.service';
import { SchedulingService } from '../pmo/scheduling.service';
import { RiskIssueService } from '../pmo/risk-issue.service';
import { ResourceService } from '../pmo/resource.service';
import { AccountLockoutService } from '../security-hardening/account-lockout.service';
import { MfaService } from '../security-hardening/mfa.service';
import { SessionService } from '../security-hardening/session.service';
import { IpRestrictionService } from '../security-hardening/ip-restriction.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { PaymentsService } from '../payments/payments.service';
import { MonoLinkedAccountService } from '../bank-integration/mono-linked-account.service';
import { InterviewService } from '../recruitment/interview.service';
import { CandidateService } from '../recruitment/candidate.service';
import { OfferService } from '../recruitment/offer.service';
import { CommissionReportingService } from '../commissions/commission-reporting.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgeting: BudgetingService,
    private readonly ap: AccountsPayableService,
    private readonly ar: AccountsReceivableService,
    private readonly crm: CrmService,
    private readonly handover: HandoverService,
    private readonly mortgage: MortgageService,
    private readonly lease: LeaseService,
    private readonly facility: FacilityService,
    private readonly reporting: ReportingService,
    private readonly notifications: NotificationsService,
    private readonly fixedAssets: FixedAssetsService,
    private readonly tax: TaxService,
    private readonly scheduling: SchedulingService,
    private readonly riskIssue: RiskIssueService,
    private readonly resource: ResourceService,
    private readonly accountLockout: AccountLockoutService,
    private readonly mfa: MfaService,
    private readonly sessions: SessionService,
    private readonly ipRestriction: IpRestrictionService,
    private readonly integrations: IntegrationsService,
    private readonly payments: PaymentsService,
    private readonly monoLinkedAccounts: MonoLinkedAccountService,
    private readonly interviews: InterviewService,
    private readonly candidates: CandidateService,
    private readonly offers: OfferService,
    private readonly commissionReporting: CommissionReportingService,
  ) {}

  /** Release K — security overview widget: currently-locked accounts + trailing failed-login/lockout counts, reusing AccountLockoutService's own aggregation. */
  getSecurityOverview(sinceHours?: number) {
    return this.accountLockout.getOverview(sinceHours ?? 24);
  }

  /** Release M — MFA adoption widget. Reuses MfaService's own aggregation rather than re-querying here, same pattern as getSecurityOverview above. */
  getMfaAdoptionOverview() {
    return this.mfa.getMfaAdoptionOverview();
  }

  /** Release N — active session count widget. Reuses SessionService's own aggregation, same pattern as getSecurityOverview/getMfaAdoptionOverview above. */
  getSessionSecurityOverview() {
    return this.sessions.getSessionOverview();
  }

  /** Release P — IP restriction widget: how many active GLOBAL vs USER-scoped rules are configured, so an admin can see at a glance whether the feature is in use at all. */
  async getIpRestrictionOverview() {
    const rules = await this.ipRestriction.listRules();
    const active = rules.filter((r) => r.isActive);
    return {
      activeGlobalRules: active.filter((r) => r.scope === 'GLOBAL').length,
      activeUserRules: active.filter((r) => r.scope === 'USER').length,
      totalRules: rules.length,
    };
  }

  /** Release J — resource utilization overview, reusing ResourceService's own aggregation. */
  getResourceUtilizationOverview(projectId: string) {
    return this.resource.getResourceUtilization(projectId);
  }

  /** Release H — PMO schedule overview: critical path + earned value for one project, composed entirely from SchedulingService's own methods (no separate query logic here). */
  async getProjectScheduleOverview(projectId: string, asOfDate?: string) {
    const [criticalPath, earnedValue] = await Promise.all([
      this.scheduling.computeCriticalPath(projectId),
      this.scheduling.computeEarnedValue(projectId, asOfDate),
    ]);
    return { criticalPath, earnedValue };
  }

  /**
   * Release I — Executive PMO Dashboard: risk/issue portfolio view.
   * projectId omitted = across every project (the portfolio-level rollup),
   * reusing RiskIssueService.getRiskIssueSummary()'s own aggregation.
   */
  getPmoRiskIssueOverview(projectId?: string) {
    return this.riskIssue.getRiskIssueSummary(projectId);
  }

  /** Release F — unread notifications widget: count plus the 5 most recent, for the header bell icon. Reuses NotificationsService entirely — no separate query here. */
  async getMyNotificationsWidget(userId: string) {
    const [count, recent] = await Promise.all([
      this.notifications.unreadCount(userId),
      this.notifications.listForUser(userId, { unreadOnly: true }, { take: 5 }),
    ]);
    return { unreadCount: count, recent };
  }

  /**
   * Phase 5A — Real Estate Analytics overview. Unlike the other
   * get*Overview() methods above, this one takes a SecurityScope because
   * it goes through ReportingService, which enforces entity-level RLS on
   * every call (see ReportingService.assertEntityAccess). None of the
   * pre-existing dashboard widgets do this today — that gap in the
   * existing dashboard is untouched here, not fixed, since fixing it
   * would mean changing every other widget's signature, which is out of
   * scope for an additive release.
   */
  async getRealEstateAnalyticsOverview(scope: SecurityScope, entityId: string, projectId?: string) {
    const [salesVelocity, inventoryAgeing, absorptionRate, unsoldUnits] = await Promise.all([
      this.reporting.salesVelocity(scope, entityId, projectId),
      this.reporting.inventoryAgeing(scope, entityId, projectId),
      this.reporting.absorptionRate(scope, entityId, projectId),
      this.reporting.unsoldUnitsDashboard(scope, entityId),
    ]);
    return { salesVelocity, inventoryAgeing, absorptionRate, unsoldUnits };
  }

  /**
   * Release — CRM Reporting Integration. Same shape of decision as
   * getRealEstateAnalyticsOverview above: this is a *new*, RLS-scoped
   * widget built on ReportingService.crmPipeline(), sitting alongside
   * (not replacing) getCrmPipelineOverview()'s pre-existing, unscoped
   * CrmService call — see ReportingService.crmPipeline's doc comment.
   */
  async getCrmAnalyticsOverview(scope: SecurityScope, entityId: string) {
    return this.reporting.crmPipeline(scope, entityId);
  }

  /**
   * Release IE.1, Checkpoint G — payments summary widget: per-status
   * transaction counts and successful-amount total for an entity. Takes
   * a SecurityScope, same as getRealEstateAnalyticsOverview/getCrmAnalyticsOverview
   * above, because PaymentsService.getOverview enforces entity-level RLS
   * (assertEntityAccess) the same way ReportingService does for those —
   * one-line delegation, same shape as getSecurityOverview/getMfaAdoptionOverview,
   * no separate query logic here.
   *
   * Release IE.2, Checkpoint H — PaymentsService.getOverview's own return
   * shape grew a refundsByStatus/totalRefundedAmount summary alongside
   * the transaction one; this method needed no change to pick that up,
   * since it was already a pure delegation.
   */
  async getPaymentsOverview(scope: SecurityScope, entityId: string) {
    return this.payments.getOverview(scope, entityId);
  }

  /**
   * Release IF.1, Checkpoint I — bank-linked-accounts widget: per-status
   * counts plus the reauth-needed and stale-sync lists for an entity.
   * One-line delegation, same shape as getPaymentsOverview above —
   * MonoLinkedAccountService.getOverview enforces entity-level RLS
   * itself, so there's no separate query logic here.
   */
  async getMonoLinkedAccountsOverview(scope: SecurityScope, entityId: string) {
    return this.monoLinkedAccounts.getOverview(scope, entityId);
  }

  /**
   * Release K — PMO Reporting Integration. Same shape of decision again:
   * a *new*, RLS-scoped widget built on ReportingService's PMO methods,
   * sitting alongside (not replacing) getProjectScheduleOverview /
   * getPmoRiskIssueOverview / getResourceUtilizationOverview's
   * pre-existing, unscoped direct PMO-service calls above.
   *
   * projectId is required here (unlike getPmoRiskIssueOverview's optional
   * one) because pmoProjectPerformance's EVM/Gantt data only makes sense
   * for a single project — there's no cross-project rollup for those two
   * yet (see ReportingService.pmoProjectPerformance's doc comment on
   * why computeCriticalPath itself isn't reused here).
   */
  async getPmoAnalyticsOverview(scope: SecurityScope, entityId: string, projectId: string) {
    const [projectPerformance, riskIssueRegister] = await Promise.all([
      this.reporting.pmoProjectPerformance(scope, entityId, projectId),
      this.reporting.pmoRiskIssueRegister(scope, entityId, projectId),
    ]);
    return { projectPerformance, riskIssueRegister };
  }

  /** CRM pipeline overview for the sales dashboard — reuses CrmService's own aggregation rather than re-querying leads/prospects here. */
  getCrmPipelineOverview(entityId?: string) {
    return this.crm.getCrmPipelineSummary(entityId);
  }

  /**
   * RE-COMM.6 — Commission dashboard widget. Pure delegation to
   * CommissionReportingService.getSummary (RE-COMM.5), the same
   * "DashboardService reuses the owning domain service's own
   * aggregation rather than re-query" pattern getCrmAnalyticsOverview
   * above already follows — no new query is written here.
   */
  getCommissionOverview(scope: SecurityScope, entityId?: string) {
    return this.commissionReporting.getSummary(scope, entityId);
  }

  /** Snag-list overview for facilities/QA — reuses HandoverService's own aggregation. */
  getSnagOverview() {
    return this.handover.getSnagSummary();
  }

  /** Mortgage exposure overview — reuses MortgageService's own aggregation rather than re-querying applications here. */
  getMortgageExposure(entityId?: string) {
    return this.mortgage.getMortgagePipelineSummary(entityId);
  }

  /** Lease / rent-roll overview — reuses LeaseService's own aggregation rather than re-querying leases here. */
  getLeaseOverview(entityId?: string) {
    return this.lease.getLeaseDashboardSummary(entityId);
  }

  /** Facility Management / Maintenance Requests overview — reuses FacilityService's own aggregation rather than re-querying here. */
  getMaintenanceOverview(entityId?: string) {
    return this.facility.getMaintenanceOverview(entityId);
  }

  /** Release (Fixed Assets Core) — register status mix, category count, and total net book value. Reuses FixedAssetsService's own aggregation rather than re-querying here. */
  getFixedAssetOverview(entityId?: string) {
    return this.fixedAssets.getFixedAssetSummary(entityId);
  }

  /** Release (Tax Center Core) — pending WHT/VAT totals. Reuses TaxService's own aggregation rather than re-querying here. */
  getTaxOverview(entityId: string) {
    return this.tax.getTaxOverview(entityId);
  }

  /**
   * Release (Executive Reporting Core). Pure composition — every figure
   * here is produced by an existing method (ReportingService's P&L /
   * financial ratios, or this class's own AP/AR/budget/cash/fixed-asset/
   * tax widgets). No new queries are written for this method; if a
   * number looks wrong, the bug lives in the widget it delegates to, not
   * here.
   */
  async getExecutiveSummary(scope: SecurityScope, entityId: string, fiscalPeriodId?: string) {
    const [pl, ratiosRows, budget, arAp, cash, fixedAssets, tax, topVarianceProjects] = await Promise.all([
      fiscalPeriodId ? this.reporting.statementOfProfitOrLoss(scope, entityId, fiscalPeriodId) : null,
      this.reporting.financialRatios(scope, entityId, fiscalPeriodId) as Promise<Record<string, unknown>[]>,
      this.getBudgetOverview(entityId),
      this.getOutstandingPayablesReceivables(entityId),
      this.getCashForecast(entityId),
      this.getFixedAssetOverview(entityId),
      this.getTaxOverview(entityId),
      this.getTopProjectsByVariance(entityId, 3),
    ]);

    // financialRatios returns every period matching the filter, oldest
    // first (see its ORDER BY period_start) — the latest one is the
    // headline figure for an executive summary.
    const latestRatios = ratiosRows.length ? ratiosRows[ratiosRows.length - 1] : null;

    return {
      entityId,
      fiscalPeriodId: fiscalPeriodId ?? null,
      profitOrLoss: pl?.current ?? null,
      financialRatios: latestRatios,
      budget,
      receivablesPayables: arAp,
      cashForecast: cash,
      fixedAssets,
      tax,
      topVarianceProjects,
    };
  }

  /**
   * Budget vs actual vs committed vs available, aggregated across every
   * APPROVED budget for the entity (optionally filtered to one fiscal
   * year). Reuses BudgetingService.variance() per budget rather than
   * re-deriving the same actual/committed logic here.
   */
  async getBudgetOverview(entityId: string, fiscalYear?: number) {
    const budgets = await this.prisma.budget.findMany({
      where: { entityId, status: BudgetStatus.APPROVED, fiscalYear },
    });

    const perBudget = await Promise.all(budgets.map((b) => this.budgeting.variance(b.id)));

    const totals = perBudget.reduce(
      (acc, b) => ({
        budgeted: acc.budgeted + b.totals.budgeted,
        actual: acc.actual + b.totals.actual,
        committed: acc.committed + b.totals.committed,
        available: acc.available + b.totals.available,
      }),
      { budgeted: 0, actual: 0, committed: 0, available: 0 },
    );

    return {
      entityId,
      fiscalYear: fiscalYear ?? null,
      totals,
      byBudget: perBudget.map((b) => ({ budgetId: b.budgetId, code: b.code, fiscalYear: b.fiscalYear, totals: b.totals })),
    };
  }

  /** Open payables vs open receivables, for the entity's headline AR/AP tile. */
  async getOutstandingPayablesReceivables(entityId: string) {
    const [payables, receivables] = await Promise.all([this.ap.getVendorAging(entityId), this.ar.getAging(entityId)]);

    const payablesTotal = payables.reduce((sum, p) => sum + p.openBalance, 0);
    const receivablesTotal = receivables.reduce((sum, r) => sum + r.openBalance, 0);

    return {
      entityId,
      payables: { total: payablesTotal, invoiceCount: payables.length },
      receivables: { total: receivablesTotal, invoiceCount: receivables.length },
      netPosition: receivablesTotal - payablesTotal,
    };
  }

  /** Cash outflow (AP due) vs inflow (AR due) over 30/60/90-day horizons. */
  async getCashForecast(entityId: string) {
    const horizons = [30, 60, 90];
    const results = await Promise.all(
      horizons.map(async (days) => {
        const [outflow, inflow] = await Promise.all([
          this.ap.getCashRequirementForecast(entityId, days),
          this.getReceivablesDueWithin(entityId, days),
        ]);
        return { days, outflow: outflow.totalDue, inflow: inflow.total, net: inflow.total - outflow.totalDue };
      }),
    );
    return { entityId, horizons: results };
  }

  private async getReceivablesDueWithin(entityId: string, days: number) {
    const through = new Date(Date.now() + days * 86_400_000);
    const invoices = await this.prisma.aRInvoice.findMany({
      where: { entityId, status: 'POSTED', dueDate: { lte: through } },
      include: { lines: true },
    });
    const open = invoices
      .map((inv) => inv.lines.reduce((sum, l) => sum + Number(l.quantity) * Number(l.unitPrice), 0) - Number(inv.amountReceived))
      .filter((balance) => balance > 0.01);
    return { total: open.reduce((sum, b) => sum + b, 0), invoiceCount: open.length };
  }

  /** Outstanding principal per active loan facility (drawdowns - principal repaid). */
  async getLoanExposure(entityId: string) {
    const facilities = await this.prisma.loanFacility.findMany({
      where: { entityId, status: { in: [LoanStatus.ACTIVE] } },
      include: { drawdowns: true, repaymentSchedule: true },
    });

    const rows = facilities.map((f) => {
      const drawn = f.drawdowns.reduce((sum, d) => sum + Number(d.amount), 0);
      const principalRepaid = f.repaymentSchedule.reduce((sum, r) => sum + Number(r.principalPaid), 0);
      return {
        facilityId: f.id,
        lenderName: f.lenderName,
        facilityAmount: Number(f.facilityAmount),
        drawn,
        principalRepaid,
        outstanding: drawn - principalRepaid,
        maturityDate: f.maturityDate,
      };
    });

    return { entityId, totalOutstanding: rows.reduce((sum, r) => sum + r.outstanding, 0), facilities: rows };
  }

  /** Latest reconciliation session per bank account, with unmatched-line counts. */
  async getBankReconciliationStatus(entityId: string) {
    const bankAccounts = await this.prisma.bankAccount.findMany({ where: { entityId, isActive: true } });

    const rows = await Promise.all(
      bankAccounts.map(async (account) => {
        const latestSession = await this.prisma.reconciliationSession.findFirst({
          where: { bankAccountId: account.id },
          orderBy: { sessionDate: 'desc' },
          include: { statement: { include: { lines: true } } },
        });
        if (!latestSession) {
          return { bankAccountId: account.id, accountName: account.accountName, status: 'NOT_STARTED', unmatchedCount: 0 };
        }
        const unmatchedCount = latestSession.statement.lines.filter((l) => !l.isMatched).length;
        return {
          bankAccountId: account.id,
          accountName: account.accountName,
          sessionId: latestSession.id,
          status: latestSession.status,
          unmatchedCount,
          isFullyReconciled: latestSession.status === ReconciliationSessionStatus.APPROVED && unmatchedCount === 0,
        };
      }),
    );

    return { entityId, bankAccounts: rows };
  }

  /**
   * Top N projects by |budgeted - actual|. Actual here is summed for
   * the whole fiscal year rather than period-matched (an intentional
   * simplification for a dashboard-grade widget, not a financial
   * statement — see BudgetingService.getActualForLine for the
   * period-precise version used in formal budget approval checks).
   */
  async getTopProjectsByVariance(entityId: string, limit = 5) {
    const lines = await this.prisma.budgetLine.findMany({
      where: { budget: { entityId, status: BudgetStatus.APPROVED }, projectId: { not: null } },
      include: { project: true, account: true },
    });

    const byProject = new Map<string, { projectId: string; projectName: string; budgeted: number; accountIds: Set<string> }>();
    for (const line of lines) {
      const key = line.projectId as string;
      const existing = byProject.get(key) ?? {
        projectId: key,
        projectName: line.project?.name ?? 'Unknown',
        budgeted: 0,
        accountIds: new Set<string>(),
      };
      existing.budgeted += Number(line.revisedAmount);
      existing.accountIds.add(line.accountId);
      byProject.set(key, existing);
    }

    const results = await Promise.all(
      Array.from(byProject.values()).map(async (p) => {
        const aggregate = await this.prisma.journalLine.aggregate({
          where: { projectId: p.projectId, entityId, accountId: { in: Array.from(p.accountIds) } },
          _sum: { debit: true, credit: true },
        });
        const actual = Number(aggregate._sum.debit ?? 0) - Number(aggregate._sum.credit ?? 0);
        return { projectId: p.projectId, projectName: p.projectName, budgeted: p.budgeted, actual, variance: p.budgeted - actual };
      }),
    );

    return results.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)).slice(0, limit);
  }

  /** Release IA — Integrations health widget, reusing IntegrationsService's own aggregation (no separate query logic here). */
  getIntegrationsHealthOverview() {
    return this.integrations.getOverview();
  }

  /**
   * Release IG.1, Checkpoint D — recruitment "needs attention" widget:
   * interviews whose calendar invite failed to sync, reusing
   * InterviewService.findWithFailedCalendarSync's own query (see that
   * method's doc comment — it was already written as "the list backing
   * the needs-attention widget" but nothing had actually called it from
   * DashboardService/DashboardController until now). No SecurityScope
   * here, matching findWithFailedCalendarSync's own signature — it
   * isn't RLS-scoped the way getMonoLinkedAccountsOverview above is.
   */
  getRecruitmentCalendarSyncFailures(entityId?: string) {
    return this.interviews.findWithFailedCalendarSync(entityId);
  }

  /**
   * Release IG.1, Checkpoint I — recruitment "needs attention" widget's
   * contact-sync half, reusing CandidateService.findWithFailedContactSync's
   * own query exactly the way getRecruitmentCalendarSyncFailures above
   * reuses InterviewService.findWithFailedCalendarSync. No SecurityScope
   * here either, matching findWithFailedContactSync's own signature.
   */
  getRecruitmentContactSyncFailures(entityId?: string) {
    return this.candidates.findWithFailedContactSync(entityId);
  }

  /**
   * Release IG.1, Checkpoint U — recruitment "needs attention" widget's
   * Teams-sync half. Checkpoint T added teamsSyncFailedAt and
   * InterviewService.findWithFailedTeamsSync (already exposed directly
   * via InterviewController), but — unlike its two sibling checkpoints
   * above (D for calendar, I for contacts) — never wired that query
   * into DashboardService/DashboardController, so the failure list had
   * no home on the aggregate "needs attention" dashboard. This closes
   * that gap the same way, reusing InterviewService's own query with no
   * new logic here.
   */
  getRecruitmentTeamsSyncFailures(entityId?: string) {
    return this.interviews.findWithFailedTeamsSync(entityId);
  }

  /**
   * Digital Signature Providers, Checkpoint D — recruitment "needs
   * attention" widget's signature-sync half, reusing
   * OfferService.findWithFailedSignatureSync's own query exactly the way
   * getRecruitmentCalendarSyncFailures/getRecruitmentContactSyncFailures/
   * getRecruitmentTeamsSyncFailures above reuse their own domain
   * services. Checkpoint C added signatureSyncFailedAt and
   * findWithFailedSignatureSync (already exposed directly via
   * OfferController's own 'signature-sync/failures' route) but never
   * wired that query into DashboardService/DashboardController, the same
   * gap Checkpoint U closed for Teams-sync after Checkpoint T. No
   * entityId param, unlike its calendar/contact/Teams siblings —
   * findWithFailedSignatureSync itself takes none (the offers table has
   * no direct entityId column; it hangs off jobApplication -> vacancy ->
   * entityId instead), so this passes nothing through rather than
   * silently accepting and dropping a filter that would look like it
   * works but never actually scope anything.
   */
  getRecruitmentSignatureSyncFailures() {
    return this.offers.findWithFailedSignatureSync();
  }
}
