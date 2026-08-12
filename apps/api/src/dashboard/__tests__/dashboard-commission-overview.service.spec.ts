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
import { InterviewService } from '../../recruitment/interview.service';
import { CandidateService } from '../../recruitment/candidate.service';
import { OfferService } from '../../recruitment/offer.service';
import { CommissionReportingService } from '../../commissions/commission-reporting.service';
import { SecurityScope } from '../../security/security.types';

/**
 * RE-COMM.6 â€” Commission dashboard widget.
 *
 * Own file for the same reason every other post-`dashboard.service.spec.ts`
 * checkpoint (Payments, Mono-linked accounts, Recruitment sync-failure
 * widgets) already keeps its own: that original file's constructor-provider
 * list predates several of DashboardService's current dependencies
 * (pre-existing, unrelated test debt, out of scope here). This file
 * provides every current dependency so DashboardService resolves cleanly,
 * and only exercises getCommissionOverview â€” the one method this
 * checkpoint adds.
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

describe('DashboardService â€” Commission Overview (RE-COMM.6, additive)', () => {
  let service: DashboardService;
  let commissionReporting: { getSummary: jest.Mock };

  beforeEach(async () => {
    commissionReporting = { getSummary: jest.fn() };

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
        { provide: CommissionReportingService, useValue: commissionReporting },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('relays CommissionReportingService.getSummary as-is, passing the scope and entityId through unchanged', async () => {
    const scope = buildUnrestrictedScope();
    const summary = {
      entityId: 'ent-1',
      earned: 500000,
      approved: 100000,
      payable: 150000,
      paid: 200000,
      outstanding: 250000,
      byStatus: {
        CALCULATED: { amount: 50000, grossAmount: 55000, count: 2 },
        PAID: { amount: 200000, grossAmount: 220000, count: 4 },
      },
    };
    commissionReporting.getSummary.mockResolvedValue(summary);

    const result = await service.getCommissionOverview(scope, 'ent-1');

    expect(commissionReporting.getSummary).toHaveBeenCalledWith(scope, 'ent-1');
    expect(result).toEqual(summary);
  });

  it('passes entityId through as undefined when omitted, matching CommissionReportingService.getSummary\'s own optional entityId', async () => {
    const scope = buildUnrestrictedScope();
    commissionReporting.getSummary.mockResolvedValue({ entityId: null, earned: 0, approved: 0, payable: 0, paid: 0, outstanding: 0, byStatus: {} });

    await service.getCommissionOverview(scope);

    expect(commissionReporting.getSummary).toHaveBeenCalledWith(scope, undefined);
  });

  it('propagates a CommissionReportingService rejection (e.g. RLS ForbiddenException) rather than swallowing it', async () => {
    commissionReporting.getSummary.mockRejectedValue(new Error('forbidden'));
    const scope = buildUnrestrictedScope();

    await expect(service.getCommissionOverview(scope, 'ent-1')).rejects.toThrow('forbidden');
  });
});

