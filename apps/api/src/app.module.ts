import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EntitiesModule } from './entities/entities.module';
import { ChartOfAccountsModule } from './chart-of-accounts/chart-of-accounts.module';
import { DimensionsModule } from './dimensions/dimensions.module';
import { GeneralLedgerModule } from './general-ledger/general-ledger.module';
import { IntercompanyModule } from './intercompany/intercompany.module';
import { ConsolidationModule } from './consolidation/consolidation.module';
import { RealEstateModule } from './real-estate/real-estate.module';
import { LandBankModule } from './land-bank/land-bank.module';
import { CrmModule } from './crm/crm.module';
import { MortgageModule } from './mortgage/mortgage.module';
import { HandoverModule } from './handover/handover.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { LeaseModule } from './lease/lease.module';
import { FacilityModule } from './facility/facility.module';
import { RevenueRecognitionModule } from './revenue-recognition/revenue-recognition.module';
import { InventoryModule } from './inventory/inventory.module';
import { PmoModule } from './pmo/pmo.module';
import { TreasuryModule } from './treasury/treasury.module';
import { FixedAssetsModule } from './fixed-assets/fixed-assets.module';
import { TaxModule } from './tax/tax.module';
import { HrPayrollModule } from './hr-payroll/hr-payroll.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { HseModule } from './hse/hse.module';
import { BudgetingModule } from './budgeting/budgeting.module';
import { ProcurementModule } from './procurement/procurement.module';
import { AccountsPayableModule } from './accounts-payable/accounts-payable.module';
import { AccountsReceivableModule } from './accounts-receivable/accounts-receivable.module';
import { BankReconciliationModule } from './bank-reconciliation/bank-reconciliation.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportingModule } from './reporting/reporting.module';
import { WorkflowModule } from './workflow/workflow.module';
import { AdminBrandingModule } from './admin-branding/admin-branding.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { SecurityModule } from './security/security.module';
import { SecurityHardeningModule } from './security-hardening/security-hardening.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { SmsModule } from './sms/sms.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { PaymentsModule } from './payments/payments.module';
import { BankIntegrationModule } from './bank-integration/bank-integration.module';
import { ImportsModule } from './imports/imports.module';
import { CalendarModule } from './calendar/calendar.module';
import { ContactsModule } from './contacts/contacts.module';
import { WorkspaceAdminModule } from './workspace-admin/workspace-admin.module';
import { TransfersModule } from './transfers/transfers.module';
import { TasksModule } from './tasks/tasks.module';
import { PresenceModule } from './presence/presence.module';
import { SignaturesModule } from './signatures/signatures.module';
import { TeamsModule } from './teams/teams.module';
import { PowerBiModule } from './power-bi/power-bi.module';
import { ApiGatewayModule } from './api-gateway/api-gateway.module';
import { AgentModule } from './agents/agent.module';
import { CommissionModule } from './commissions/commission.module';
import { PartnerApiModule } from './partner-api/partner-api.module';
import { SearchModule } from './search/search.module';

import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { EntityAccessGuard } from './security/entity-access.guard';
import { IpRestrictionGuard } from './security-hardening/ip-restriction.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    SecurityModule,
    AuthModule,
    EntitiesModule,
    ChartOfAccountsModule,
    DimensionsModule,
    GeneralLedgerModule,
    IntercompanyModule,
    ConsolidationModule,
    RealEstateModule,
    LandBankModule,
    CrmModule,
    MortgageModule,
    HandoverModule,
    CustomerPortalModule,
    LeaseModule,
    FacilityModule,
    RevenueRecognitionModule,
    InventoryModule,
    PmoModule,
    TreasuryModule,
    FixedAssetsModule,
    TaxModule,
    HrPayrollModule,
    RecruitmentModule,
    HseModule,
    BudgetingModule,
    ProcurementModule,
    AccountsPayableModule,
    AccountsReceivableModule,
    BankReconciliationModule,
    DashboardModule,
    ReportingModule,
    WorkflowModule,
    AdminBrandingModule,
    HealthModule,
    QueueModule,
    NotificationsModule,
    FeatureFlagsModule,
    RolesModule,
    UsersModule,
    MonitoringModule,
    SecurityHardeningModule,
    IntegrationsModule,
    SmsModule,
    WhatsAppModule,
    PaymentsModule,
    BankIntegrationModule,
    ImportsModule,
    CalendarModule,
    ContactsModule,
    WorkspaceAdminModule,
    TransfersModule,
    TasksModule,
    PresenceModule,
    SignaturesModule,
    TeamsModule,
    PowerBiModule,
    ApiGatewayModule,
    AgentModule,
    CommissionModule,
    PartnerApiModule,
    SearchModule,
  ],
  providers: [
    AuditInterceptor,
    // Every route requires a valid JWT unless annotated @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Release P — IP Restrictions: runs right after JwtAuthGuard so
    // request.user is populated, and before permission/RLS checks — an
    // IP-blocked caller shouldn't get far enough to learn what
    // permissions or entities they'd otherwise have. Not decorator-gated
    // (see IpRestrictionGuard's own doc comment for why).
    { provide: APP_GUARD, useClass: IpRestrictionGuard },
    // Every route additionally checks fine-grained RBAC permissions
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Phase 2: write-path RLS enforcement for routes annotated @RlsBodyCheck().
    // Must run after the two guards above populate/authorize request.user —
    // see SecurityModule's doc comment for why this isn't bound there instead.
    { provide: APP_GUARD, useClass: EntityAccessGuard },
  ],
})
export class AppModule {}
