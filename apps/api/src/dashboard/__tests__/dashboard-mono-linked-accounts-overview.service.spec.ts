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
 * Release IF.1, Checkpoint I â€” Bank Integration dashboard integration.
 *
 * Kept as its OWN file for the same reason
 * dashboard-payments-overview.service.spec.ts is: the pre-existing
 * dashboard.service.spec.ts constructor-provider list predates several
 * of DashboardService's current dependencies (unrelated, out-of-scope
 * test debt), so this file provides every current dependency and only
 * exercises getMonoLinkedAccountsOverview â€” the one method this
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

describe('DashboardService â€” Mono Linked Accounts Overview (Release IF.1, Checkpoint I, additive)', () => {
  let service: DashboardService;
  let monoLinkedAccounts: { getOverview: jest.Mock };

  beforeEach(async () => {
    monoLinkedAccounts = { getOverview: jest.fn() };

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
        { provide: PaymentsService, useValue: {} },
        { provide: MonoLinkedAccountService, useValue: monoLinkedAccounts },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('relays MonoLinkedAccountService.getOverview as-is, passing the scope and entityId through unchanged', async () => {
    const scope = buildUnrestrictedScope();
    const overview = {
      entityId: 'ent-1',
      totalLinked: 2,
      byStatus: { ACTIVE: 1, REVOKED: 0, REQUIRES_REAUTH: 1 },
      needsReauth: [{ id: 'acc-2', institutionName: 'Access Bank', accountNumberMasked: '****2222', reauthRequiredAt: new Date('2026-07-30T10:00:00Z') }],
      staleActiveAccounts: [],
    };
    monoLinkedAccounts.getOverview.mockResolvedValue(overview);

    const result = await service.getMonoLinkedAccountsOverview(scope, 'ent-1');

    expect(monoLinkedAccounts.getOverview).toHaveBeenCalledWith(scope, 'ent-1');
    expect(result).toEqual(overview);
  });

  it('propagates a MonoLinkedAccountService rejection (e.g. RLS ForbiddenException) rather than swallowing it', async () => {
    monoLinkedAccounts.getOverview.mockRejectedValue(new Error('forbidden'));
    const scope = buildUnrestrictedScope();

    await expect(service.getMonoLinkedAccountsOverview(scope, 'ent-1')).rejects.toThrow('forbidden');
  });
});


