import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { BudgetingModule } from '../budgeting/budgeting.module';
import { AccountsPayableModule } from '../accounts-payable/accounts-payable.module';
import { AccountsReceivableModule } from '../accounts-receivable/accounts-receivable.module';
import { CrmModule } from '../crm/crm.module';
import { HandoverModule } from '../handover/handover.module';
import { MortgageModule } from '../mortgage/mortgage.module';
import { LeaseModule } from '../lease/lease.module';
import { FacilityModule } from '../facility/facility.module';
import { ReportingModule } from '../reporting/reporting.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FixedAssetsModule } from '../fixed-assets/fixed-assets.module';
import { TaxModule } from '../tax/tax.module';
import { PmoModule } from '../pmo/pmo.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { SecurityHardeningModule } from '../security-hardening/security-hardening.module';
import { PaymentsModule } from '../payments/payments.module';
import { BankIntegrationModule } from '../bank-integration/bank-integration.module';
import { RecruitmentModule } from '../recruitment/recruitment.module';
import { CommissionModule } from '../commissions/commission.module';

@Module({
  imports: [
    BudgetingModule,
    AccountsPayableModule,
    AccountsReceivableModule,
    CrmModule,
    HandoverModule,
    MortgageModule,
    LeaseModule,
    FacilityModule,
    ReportingModule, // Phase 5A — Real Estate Analytics (additive)
    NotificationsModule, // Release F — Notifications API (additive)
    FixedAssetsModule, // Release — Fixed Assets Core (additive)
    TaxModule, // Release — Tax Center Core (additive)
    PmoModule, // Release H — PMO Scheduling Core (additive)
    SecurityHardeningModule, // Release K — Security Hardening Part 1 (additive)
    IntegrationsModule, // Release IA — Core Integration Framework (additive)
    PaymentsModule, // Release IE.1, Checkpoint G — Payment Framework dashboard integration (additive)
    BankIntegrationModule, // Release IF.1, Checkpoint I — Bank Integration dashboard integration (additive)
    RecruitmentModule, // Release IG.1, Checkpoint D — Recruitment calendar-sync-failures dashboard integration (additive)
    CommissionModule, // RE-COMM.6 — Commission dashboard widget, reuses CommissionReportingService.getSummary (additive)
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
