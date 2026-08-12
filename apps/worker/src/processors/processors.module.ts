import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { InternalApiModule } from '../internal-api/internal-api.module';
import { JobsModule } from '../jobs/jobs.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

import { PayrollProcessor } from './payroll.processor';
import { EmailProcessor } from './email.processor';
import { NotificationProcessor } from './notification.processor';
import { BankStatementImportProcessor } from './bank-statement-import.processor';
import { BudgetRecalculationProcessor } from './budget-recalculation.processor';
import { DashboardRefreshProcessor } from './dashboard-refresh.processor';
import { ReportGenerationProcessor } from './report-generation.processor';
import { IntegrationHealthCheckProcessor } from './integration-health-check.processor';
import { SmsProcessor } from './sms.processor';
import { WhatsAppProcessor } from './whatsapp.processor';
import { PaymentReconciliationProcessor } from './payment-reconciliation.processor';
import { MonoStatementSyncProcessor } from './mono-statement-sync.processor';
import { BankTransferReconciliationProcessor } from './bank-transfer-reconciliation.processor';
import { SignatureReconciliationProcessor } from './signature-reconciliation.processor';

@Module({
  imports: [QueuesModule, InternalApiModule, JobsModule, FeatureFlagsModule, MailModule, SmsModule, WhatsAppModule],
  providers: [
    PayrollProcessor,
    EmailProcessor,
    NotificationProcessor,
    BankStatementImportProcessor,
    BudgetRecalculationProcessor,
    DashboardRefreshProcessor,
    ReportGenerationProcessor,
    IntegrationHealthCheckProcessor,
    SmsProcessor,
    WhatsAppProcessor,
    PaymentReconciliationProcessor,
    MonoStatementSyncProcessor,
    BankTransferReconciliationProcessor,
    SignatureReconciliationProcessor,
  ],
})
export class ProcessorsModule {}
