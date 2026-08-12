import { Module } from '@nestjs/common';
import { PowerBiProviderRegistry } from './power-bi-provider.registry';
import { PowerBiHealthCheckDriver } from './providers/power-bi-health-check.driver';
import { PowerBiProviderImpl } from './providers/power-bi.provider';
import { PowerBiService } from './power-bi.service';
import { PowerBiController } from './power-bi.controller';
import { INTEGRATION_DRIVER_REGISTRY } from '../integrations/integration-provider-driver.interface';
import { IntegrationsModule } from '../integrations/integrations.module';

// Power BI, Checkpoint C — registers the health-check driver for the
// POWER_BI providerCode into the (module-load-time-populated)
// INTEGRATION_DRIVER_REGISTRY, the same pattern storage.module.ts uses
// for AWS_S3/GOOGLE_DRIVE and workspace-admin.module.ts uses for
// GOOGLE_WORKSPACE_ADMIN. See power-bi-health-check.driver.ts's own doc
// comment for the credential/config shape this proves out.
INTEGRATION_DRIVER_REGISTRY['POWER_BI'] = new PowerBiHealthCheckDriver();

/**
 * Power BI, Checkpoint A started with the registry only, same minimal
 * shape SignaturesModule/CalendarModule/ContactsModule/
 * BankIntegrationModule/TransfersModule all started with at their own
 * Checkpoint A.
 *
 * Checkpoint C added the credential shape + health-check driver above.
 *
 * Checkpoint D added the first (and so far only) concrete provider,
 * PowerBiProviderImpl.
 *
 * This checkpoint adds PowerBiService/PowerBiController — the same gap
 * CalendarService/ContactsService/TasksService closed for their own
 * domains. Same scope decision: no Prisma persistence, and no opinion
 * on what should be published as a dataset — see PowerBiService's own
 * doc comment.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [PowerBiProviderRegistry, PowerBiProviderImpl, PowerBiService],
  controllers: [PowerBiController],
  exports: [PowerBiProviderRegistry, PowerBiService],
})
export class PowerBiModule {}
