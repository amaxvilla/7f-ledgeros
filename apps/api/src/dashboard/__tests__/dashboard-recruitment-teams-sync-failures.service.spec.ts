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

/**
 * Release IG.1, Checkpoint U — Recruitment Teams-sync-failures dashboard
 * integration.
 *
 * Own file for the same reason
 * dashboard-recruitment-contact-sync-failures.service.spec.ts is: the
 * pre-existing dashboard.service.spec.ts constructor-provider list
 * predates several of DashboardService's current dependencies (unrelated,
 * out-of-scope test debt), so this file provides every current
 * dependency and only exercises getRecruitmentTeamsSyncFailures — the
 * one method this checkpoint adds. Checkpoint T itself (teamsSyncFailedAt,
 * InterviewService.findWithFailedTeamsSync) already had its own test
 * coverage in recruitment's own test suite; this file covers only the
 * dashboard wiring that was missing until now.
 */
describe('DashboardService — Recruitment Teams Sync Failures (Release IG.1, Checkpoint U, additive)', () => {
  let service: DashboardService;
  let interviews: { findWithFailedTeamsSync: jest.Mock };

  beforeEach(async () => {
    interviews = { findWithFailedTeamsSync: jest.fn() };

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
            { provide: CommissionReportingService, useValue: {} },
        { provide: AccountLockoutService, useValue: {} },
        { provide: MfaService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: IpRestrictionService, useValue: {} },
        { provide: IntegrationsService, useValue: {} },
        { provide: PaymentsService, useValue: {} },
        { provide: MonoLinkedAccountService, useValue: {} },
        { provide: InterviewService, useValue: interviews },
        { provide: CandidateService, useValue: {} },
        { provide: OfferService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('relays InterviewService.findWithFailedTeamsSync as-is, passing entityId through unchanged', async () => {
    const failures = [
      { id: 'i-1', candidateName: 'Ada Lovelace', scheduledAt: new Date('2026-07-30T09:00:00Z'), teamsSyncFailedAt: new Date('2026-07-30T09:05:00Z') },
    ];
    interviews.findWithFailedTeamsSync.mockResolvedValue(failures);

    const result = await service.getRecruitmentTeamsSyncFailures('ent-1');

    expect(interviews.findWithFailedTeamsSync).toHaveBeenCalledWith('ent-1');
    expect(result).toEqual(failures);
  });

  it('passes undefined through when no entityId is given, for the cross-entity total', async () => {
    interviews.findWithFailedTeamsSync.mockResolvedValue([]);

    await service.getRecruitmentTeamsSyncFailures();

    expect(interviews.findWithFailedTeamsSync).toHaveBeenCalledWith(undefined);
  });

  it('propagates a rejection rather than swallowing it', async () => {
    interviews.findWithFailedTeamsSync.mockRejectedValue(new Error('db unreachable'));
    await expect(service.getRecruitmentTeamsSyncFailures('ent-1')).rejects.toThrow('db unreachable');
  });
});


