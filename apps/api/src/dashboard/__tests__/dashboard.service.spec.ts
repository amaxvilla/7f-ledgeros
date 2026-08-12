import { Test } from '@nestjs/testing';
import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BudgetingService } from '../../budgeting/budgeting.service';
import { AccountsPayableService } from '../../accounts-payable/accounts-payable.service';
import { AccountsReceivableService } from '../../accounts-receivable/accounts-receivable.service';
import { CrmService } from '../../crm/crm.service';
import { HandoverService } from '../../handover/handover.service';
import { MortgageService } from '../../mortgage/mortgage.service';
import { LeaseService } from '../../lease/lease.service';
import { FacilityService } from '../../facility/facility.service';
import { ReportingService } from '../../reporting/reporting.service';
import { SecurityScope } from '../../security/security.types';
import { AccountLockoutService } from '../../security-hardening/account-lockout.service';
import { MfaService } from '../../security-hardening/mfa.service';
import { SessionService } from '../../security-hardening/session.service';
import { IpRestrictionService } from '../../security-hardening/ip-restriction.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { PaymentsService } from '../../payments/payments.service';
import { MonoLinkedAccountService } from '../../bank-integration/mono-linked-account.service';
import { InterviewService } from '../../recruitment/interview.service';
import { CandidateService } from '../../recruitment/candidate.service';
import { OfferService } from '../../recruitment/offer.service';
import { CommissionReportingService } from '../../commissions/commission-reporting.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { FixedAssetsService } from '../../fixed-assets/fixed-assets.service';
import { TaxService } from '../../tax/tax.service';
import { SchedulingService } from '../../pmo/scheduling.service';
import { RiskIssueService } from '../../pmo/risk-issue.service';
import { ResourceService } from '../../pmo/resource.service';

/**
 * Phase 5A — Real Estate Analytics (additive).
 *
 * NOTE: DashboardService had zero test coverage before this slice (see
 * the release audit — "dashboard" was in the untested-modules list).
 * This file only covers the one method added in this release,
 * getRealEstateAnalyticsOverview(); it does not attempt to backfill
 * coverage for the pre-existing get*Overview() methods, which is out of
 * scope for an additive release.
 */
function buildUnrestrictedScope(): SecurityScope {
  const unrestricted = { unrestricted: true, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: unrestricted,
    department: unrestricted,
    costCenter: unrestricted,
    project: unrestricted,
    businessUnit: unrestricted,
  };
}

describe('DashboardService — Real Estate Analytics (Phase 5A, additive)', () => {
  let service: DashboardService;
  let reporting: { salesVelocity: jest.Mock; inventoryAgeing: jest.Mock; absorptionRate: jest.Mock; unsoldUnitsDashboard: jest.Mock };
  let notifications: { unreadCount: jest.Mock; listForUser: jest.Mock };

  beforeEach(async () => {
    reporting = {
      salesVelocity: jest.fn().mockResolvedValue([{ month: '2026-06' }]),
      inventoryAgeing: jest.fn().mockResolvedValue([{ unitId: 'u-1' }]),
      absorptionRate: jest.fn().mockResolvedValue([{ percent: 12.5 }]),
      unsoldUnitsDashboard: jest.fn().mockResolvedValue([{ availableCount: 4 }]),
    };
    notifications = {
      unreadCount: jest.fn().mockResolvedValue(3),
      listForUser: jest.fn().mockResolvedValue([{ id: 'notif-1' }]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: {} },
        { provide: BudgetingService, useValue: {} },
        { provide: AccountsPayableService, useValue: {} },
        { provide: AccountsReceivableService, useValue: {} },
        { provide: CrmService, useValue: {} },
        { provide: HandoverService, useValue: {} },
        { provide: MortgageService, useValue: {} },
        { provide: LeaseService, useValue: {} },
        { provide: FacilityService, useValue: {} },
        { provide: ReportingService, useValue: reporting },
        { provide: NotificationsService, useValue: notifications },
        { provide: FixedAssetsService, useValue: {} },
        { provide: TaxService, useValue: {} },
        { provide: SchedulingService, useValue: {} },
        { provide: RiskIssueService, useValue: {} },
        { provide: ResourceService, useValue: {} },
            { provide: AccountLockoutService, useValue: {} },
            { provide: MfaService, useValue: {} },
            { provide: SessionService, useValue: {} },
            { provide: IpRestrictionService, useValue: {} },
            { provide: IntegrationsService, useValue: {} },
            { provide: PaymentsService, useValue: {} },
            { provide: MonoLinkedAccountService, useValue: {} },
    { provide: InterviewService, useValue: {} },
    { provide: CandidateService, useValue: {} },
    { provide: OfferService, useValue: {} },
    { provide: CommissionReportingService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('fans out to all four ReportingService analytics methods and returns them under named keys', async () => {
    const scope = buildUnrestrictedScope();
    const result = await service.getRealEstateAnalyticsOverview(scope, 'ent-1', 'proj-1');

    expect(reporting.salesVelocity).toHaveBeenCalledWith(scope, 'ent-1', 'proj-1');
    expect(reporting.inventoryAgeing).toHaveBeenCalledWith(scope, 'ent-1', 'proj-1');
    expect(reporting.absorptionRate).toHaveBeenCalledWith(scope, 'ent-1', 'proj-1');
    expect(reporting.unsoldUnitsDashboard).toHaveBeenCalledWith(scope, 'ent-1');

    expect(result).toEqual({
      salesVelocity: [{ month: '2026-06' }],
      inventoryAgeing: [{ unitId: 'u-1' }],
      absorptionRate: [{ percent: 12.5 }],
      unsoldUnits: [{ availableCount: 4 }],
    });
  });

  it('propagates a ReportingService rejection (e.g. RLS ForbiddenException) rather than swallowing it', async () => {
    reporting.salesVelocity.mockRejectedValue(new Error('forbidden'));
    const scope = buildUnrestrictedScope();
    await expect(service.getRealEstateAnalyticsOverview(scope, 'ent-1')).rejects.toThrow('forbidden');
  });

  it('Release F: getMyNotificationsWidget reuses NotificationsService for both the count and the recent list', async () => {
    const result = await service.getMyNotificationsWidget('user-1');

    expect(notifications.unreadCount).toHaveBeenCalledWith('user-1');
    expect(notifications.listForUser).toHaveBeenCalledWith('user-1', { unreadOnly: true }, { take: 5 });
    expect(result).toEqual({ unreadCount: 3, recent: [{ id: 'notif-1' }] });
  });

  it('Release — CRM Reporting Integration: getCrmAnalyticsOverview relays ReportingService.crmPipeline as-is', async () => {
    (reporting as any).crmPipeline = jest.fn().mockResolvedValue({ totalLeads: 4, leadConversionRate: 0.5 });
    const scope = buildUnrestrictedScope();

    const result = await service.getCrmAnalyticsOverview(scope, 'ent-1');

    expect((reporting as any).crmPipeline).toHaveBeenCalledWith(scope, 'ent-1');
    expect(result).toEqual({ totalLeads: 4, leadConversionRate: 0.5 });
  });

  it('Release K — PMO Reporting Integration: getPmoAnalyticsOverview combines pmoProjectPerformance and pmoRiskIssueRegister', async () => {
    (reporting as any).pmoProjectPerformance = jest.fn().mockResolvedValue({ schedule: { tasks: [] }, earnedValue: { SPI: 1 } });
    (reporting as any).pmoRiskIssueRegister = jest.fn().mockResolvedValue({ risksByStatus: [] });
    const scope = buildUnrestrictedScope();

    const result = await service.getPmoAnalyticsOverview(scope, 'ent-1', 'proj-1');

    expect((reporting as any).pmoProjectPerformance).toHaveBeenCalledWith(scope, 'ent-1', 'proj-1');
    expect((reporting as any).pmoRiskIssueRegister).toHaveBeenCalledWith(scope, 'ent-1', 'proj-1');
    expect(result).toEqual({
      projectPerformance: { schedule: { tasks: [] }, earnedValue: { SPI: 1 } },
      riskIssueRegister: { risksByStatus: [] },
    });
  });

  describe('Release — Executive Reporting Core: getExecutiveSummary', () => {
    // Pure composition method — every figure comes from another method
    // (some already covered by their own tests elsewhere). Isolate the
    // composition itself by spying on this class's own widget methods
    // rather than re-mocking prisma/ap/ar/etc. down at their level.
    it('fans out to P&L, financial ratios, and every existing widget, and takes the latest ratios row', async () => {
      (reporting as any).statementOfProfitOrLoss = jest.fn().mockResolvedValue({ current: { netProfit: 500 } });
      (reporting as any).financialRatios = jest.fn().mockResolvedValue([{ period_start: '2026-01-01' }, { period_start: '2026-02-01' }]);
      jest.spyOn(service, 'getBudgetOverview').mockResolvedValue({ totals: { budgeted: 1 } } as any);
      jest.spyOn(service, 'getOutstandingPayablesReceivables').mockResolvedValue({ netPosition: 2 } as any);
      jest.spyOn(service, 'getCashForecast').mockResolvedValue({ horizons: [] } as any);
      jest.spyOn(service, 'getFixedAssetOverview').mockResolvedValue({ totalNetBookValue: 3 } as any);
      jest.spyOn(service, 'getTaxOverview').mockResolvedValue({ whtPendingAmount: 4 } as any);
      jest.spyOn(service, 'getTopProjectsByVariance').mockResolvedValue([{ projectId: 'p1' }] as any);

      const scope = buildUnrestrictedScope();
      const result = await service.getExecutiveSummary(scope, 'ent-1', 'fp-1');

      expect((reporting as any).statementOfProfitOrLoss).toHaveBeenCalledWith(scope, 'ent-1', 'fp-1');
      expect((reporting as any).financialRatios).toHaveBeenCalledWith(scope, 'ent-1', 'fp-1');
      expect(service.getTopProjectsByVariance).toHaveBeenCalledWith('ent-1', 3);

      expect(result.profitOrLoss).toEqual({ netProfit: 500 });
      expect(result.financialRatios).toEqual({ period_start: '2026-02-01' }); // latest, not first
      expect(result.budget).toEqual({ totals: { budgeted: 1 } });
      expect(result.receivablesPayables).toEqual({ netPosition: 2 });
      expect(result.fixedAssets).toEqual({ totalNetBookValue: 3 });
      expect(result.tax).toEqual({ whtPendingAmount: 4 });
    });

    it('returns a null profitOrLoss (rather than throwing) when no fiscalPeriodId is given', async () => {
      (reporting as any).financialRatios = jest.fn().mockResolvedValue([]);
      jest.spyOn(service, 'getBudgetOverview').mockResolvedValue({} as any);
      jest.spyOn(service, 'getOutstandingPayablesReceivables').mockResolvedValue({} as any);
      jest.spyOn(service, 'getCashForecast').mockResolvedValue({} as any);
      jest.spyOn(service, 'getFixedAssetOverview').mockResolvedValue({} as any);
      jest.spyOn(service, 'getTaxOverview').mockResolvedValue({} as any);
      jest.spyOn(service, 'getTopProjectsByVariance').mockResolvedValue([] as any);

      const result = await service.getExecutiveSummary(buildUnrestrictedScope(), 'ent-1');

      expect(result.profitOrLoss).toBeNull();
      expect(result.financialRatios).toBeNull();
    });
  });
});



