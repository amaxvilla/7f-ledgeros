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
 * Digital Signature Providers, Checkpoint D — Recruitment
 * signature-sync-failures dashboard integration.
 *
 * Own file for the same reason
 * dashboard-recruitment-teams-sync-failures.service.spec.ts is: the
 * pre-existing dashboard.service.spec.ts constructor-provider list
 * predates several of DashboardService's current dependencies (unrelated,
 * out-of-scope test debt), so this file provides every current
 * dependency and only exercises getRecruitmentSignatureSyncFailures — the
 * one method this checkpoint adds. Checkpoint C itself
 * (signatureSyncFailedAt, OfferService.findWithFailedSignatureSync)
 * already had its own test coverage in recruitment's own test suite;
 * this file covers only the dashboard wiring that was missing until now.
 */
describe('DashboardService — Recruitment Signature Sync Failures (Digital Signature Providers, Checkpoint D, additive)', () => {
  let service: DashboardService;
  let offers: { findWithFailedSignatureSync: jest.Mock };

  beforeEach(async () => {
    offers = { findWithFailedSignatureSync: jest.fn() };

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
        { provide: InterviewService, useValue: {} },
        { provide: CandidateService, useValue: {} },
        { provide: OfferService, useValue: offers },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('relays OfferService.findWithFailedSignatureSync as-is', async () => {
    const failures = [
      { id: 'o-1', jobTitle: 'Backend Engineer', status: 'SENT', sentAt: new Date('2026-07-30T09:00:00Z'), signatureSyncFailedAt: new Date('2026-07-30T09:05:00Z') },
    ];
    offers.findWithFailedSignatureSync.mockResolvedValue(failures);

    const result = await service.getRecruitmentSignatureSyncFailures();

    expect(offers.findWithFailedSignatureSync).toHaveBeenCalledWith();
    expect(result).toEqual(failures);
  });

  it('takes no arguments, unlike its calendar/contact/Teams siblings', async () => {
    offers.findWithFailedSignatureSync.mockResolvedValue([]);

    await service.getRecruitmentSignatureSyncFailures();

    expect(offers.findWithFailedSignatureSync).toHaveBeenCalledWith();
  });

  it('propagates a rejection rather than swallowing it', async () => {
    offers.findWithFailedSignatureSync.mockRejectedValue(new Error('db unreachable'));
    await expect(service.getRecruitmentSignatureSyncFailures()).rejects.toThrow('db unreachable');
  });
});


