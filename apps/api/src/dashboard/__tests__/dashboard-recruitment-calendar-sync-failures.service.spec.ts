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

describe('DashboardService â€” Recruitment Calendar Sync Failures (Release IG.1, Checkpoint D, additive)', () => {
  let service: DashboardService;

  let interviews: {
    findWithFailedCalendarSync: jest.Mock;
  };

  beforeEach(async () => {
    interviews = {
      findWithFailedCalendarSync: jest.fn(),
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
        { provide: InterviewService, useValue: interviews },
        { provide: CandidateService, useValue: {} },
        { provide: OfferService, useValue: {} },

        // DashboardService now injects CommissionReportingService.
        // This test does not exercise commission reporting, so a minimal
        // mock is sufficient.
        {
          provide: CommissionReportingService,
          useValue: {},
        },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
  });

  it('relays InterviewService.findWithFailedCalendarSync as-is, passing entityId through unchanged', async () => {
    const failures = [
      {
        id: 'int-1',
        title: 'Technical screen',
        scheduledAt: new Date('2026-08-01T10:00:00Z'),
        status: 'SCHEDULED',
        calendarSyncFailedAt: new Date('2026-07-30T09:00:00Z'),
      },
    ];

    interviews.findWithFailedCalendarSync.mockResolvedValue(failures);

    const result =
      await service.getRecruitmentCalendarSyncFailures('ent-1');

    expect(interviews.findWithFailedCalendarSync).toHaveBeenCalledWith(
      'ent-1',
    );
    expect(result).toEqual(failures);
  });

  it('passes undefined through when no entityId is given, for the cross-entity total', async () => {
    interviews.findWithFailedCalendarSync.mockResolvedValue([]);

    const result = await service.getRecruitmentCalendarSyncFailures();

    expect(interviews.findWithFailedCalendarSync).toHaveBeenCalledWith(
      undefined,
    );
    expect(result).toEqual([]);
  });

  it('propagates InterviewService errors rather than swallowing them', async () => {
    interviews.findWithFailedCalendarSync.mockRejectedValue(
      new Error('calendar sync lookup failed'),
    );

    await expect(
      service.getRecruitmentCalendarSyncFailures('ent-1'),
    ).rejects.toThrow('calendar sync lookup failed');
  });
});
