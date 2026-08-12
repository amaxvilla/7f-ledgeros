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
import { NotificationsService } from '../../notifications/notifications.service';
import { FixedAssetsService } from '../../fixed-assets/fixed-assets.service';
import { TaxService } from '../../tax/tax.service';
import { SchedulingService } from '../../pmo/scheduling.service';
import { RiskIssueService } from '../../pmo/risk-issue.service';
import { ResourceService } from '../../pmo/resource.service';
import { AccountLockoutService } from '../../security-hardening/account-lockout.service';
import { MfaService } from '../../security-hardening/mfa.service';
import { SessionService } from '../../security-hardening/session.service';
import { IpRestrictionService } from '../../security-hardening/ip-restriction.service';
import { IntegrationsService } from '../../integrations/integrations.service';
import { PaymentsService } from '../../payments/payments.service';
import { MonoLinkedAccountService } from '../../bank-integration/mono-linked-account.service';
import { SecurityScope } from '../../security/security.types';
import { InterviewService } from '../../recruitment/interview.service';
import { CandidateService } from '../../recruitment/candidate.service';
import { OfferService } from '../../recruitment/offer.service';
import { CommissionReportingService } from '../../commissions/commission-reporting.service';

/**
 * Release IE.1, Checkpoint G — Payment Framework dashboard integration.
 *
 * Kept as its OWN file rather than appended to dashboard.service.spec.ts:
 * that file's constructor-provider list already predates
 * AccountLockoutService/MfaService/SessionService/IpRestrictionService/
 * IntegrationsService being added to DashboardService's constructor (a
 * pre-existing gap, unrelated to this checkpoint and out of scope to
 * fix here), so appending to it would mean either perpetuating that gap
 * for a new test or fixing unrelated test debt inside an additive
 * payments release. This file provides every current constructor
 * dependency so DashboardService resolves cleanly, and only exercises
 * getPaymentsOverview — the one method this checkpoint adds.
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

describe('DashboardService — Payments Overview (Release IE.1, Checkpoint G, additive)', () => {
  let service: DashboardService;
  let payments: { getOverview: jest.Mock };

  beforeEach(async () => {
    payments = { getOverview: jest.fn() };

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
        { provide: ReportingService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: FixedAssetsService, useValue: {} },
        { provide: TaxService, useValue: {} },
        { provide: SchedulingService, useValue: {} },
        { provide: RiskIssueService, useValue: {} },
        { provide: ResourceService, useValue: {} },
{ provide: InterviewService, useValue: {} },
{ provide: CandidateService, useValue: {} },
{ provide: OfferService, useValue: {} },
{ provide: CommissionReportingService, useValue: {} },
        { provide: AccountLockoutService, useValue: {} },
        { provide: MfaService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: IpRestrictionService, useValue: {} },
        { provide: IntegrationsService, useValue: {} },
        { provide: PaymentsService, useValue: payments },
      { provide: MonoLinkedAccountService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('relays PaymentsService.getOverview as-is, passing the scope and entityId through unchanged', async () => {
    const scope = buildUnrestrictedScope();
    const overview = {
      entityId: 'ent-1',
      totalCount: 3,
      successfulAmount: 50000,
      byStatus: {
        PENDING: { count: 1, totalAmount: 10000 },
        SUCCESSFUL: { count: 2, totalAmount: 50000 },
        FAILED: { count: 0, totalAmount: 0 },
        ABANDONED: { count: 0, totalAmount: 0 },
      },
    };
    payments.getOverview.mockResolvedValue(overview);

    const result = await service.getPaymentsOverview(scope, 'ent-1');

    expect(payments.getOverview).toHaveBeenCalledWith(scope, 'ent-1');
    expect(result).toEqual(overview);
  });

  it('propagates a PaymentsService rejection (e.g. RLS ForbiddenException) rather than swallowing it', async () => {
    payments.getOverview.mockRejectedValue(new Error('forbidden'));
    const scope = buildUnrestrictedScope();

    await expect(service.getPaymentsOverview(scope, 'ent-1')).rejects.toThrow('forbidden');
  });
});


