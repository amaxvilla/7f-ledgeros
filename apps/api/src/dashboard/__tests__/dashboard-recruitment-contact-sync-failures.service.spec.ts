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
 * Release IG.1, Checkpoint I — Recruitment contact-sync-failures
 * dashboard integration.
 *
 * Own file for the same reason
 * dashboard-recruitment-calendar-sync-failures.service.spec.ts is: the
 * pre-existing dashboard.service.spec.ts constructor-provider list
 * predates several of DashboardService's current dependencies (unrelated,
 * out-of-scope test debt), so this file provides every current
 * dependency and only exercises getRecruitmentContactSyncFailures — the
 * one method this checkpoint adds.
 */
describe('DashboardService — Recruitment Contact Sync Failures (Release IG.1, Checkpoint I, additive)', () => {
  let service: DashboardService;
  let candidates: { findWithFailedContactSync: jest.Mock };

  beforeEach(async () => {
    candidates = { findWithFailedContactSync: jest.fn() };

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
        { provide: CandidateService, useValue: candidates },
        { provide: OfferService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('relays CandidateService.findWithFailedContactSync as-is, passing entityId through unchanged', async () => {
    const failures = [
      { id: 'c-1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', contactSyncFailedAt: new Date('2026-07-30T09:00:00Z') },
    ];
    candidates.findWithFailedContactSync.mockResolvedValue(failures);

    const result = await service.getRecruitmentContactSyncFailures('ent-1');

    expect(candidates.findWithFailedContactSync).toHaveBeenCalledWith('ent-1');
    expect(result).toEqual(failures);
  });

  it('passes undefined through when no entityId is given, for the cross-entity total', async () => {
    candidates.findWithFailedContactSync.mockResolvedValue([]);

    await service.getRecruitmentContactSyncFailures();

    expect(candidates.findWithFailedContactSync).toHaveBeenCalledWith(undefined);
  });

  it('propagates a rejection rather than swallowing it', async () => {
    candidates.findWithFailedContactSync.mockRejectedValue(new Error('db unreachable'));
    await expect(service.getRecruitmentContactSyncFailures('ent-1')).rejects.toThrow('db unreachable');
  });
});


