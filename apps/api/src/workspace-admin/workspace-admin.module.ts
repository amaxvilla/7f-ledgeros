import { Module } from '@nestjs/common';
import { WorkspaceAdminProviderRegistry } from './workspace-admin-provider.registry';
import { GoogleWorkspaceAdminHealthCheckDriver } from './providers/google-workspace-admin-health-check.driver';
import { GoogleWorkspaceAdminProvider } from './providers/google-workspace-admin.provider';
import { WorkspaceAdminService } from './workspace-admin.service';
import { WorkspaceAdminController } from './workspace-admin.controller';
import { INTEGRATION_DRIVER_REGISTRY } from '../integrations/integration-provider-driver.interface';
import { IntegrationsModule } from '../integrations/integrations.module';

// Release IH, Checkpoint G — registers the health-check driver for the
// GOOGLE_WORKSPACE_ADMIN providerCode into the (module-load-time-populated)
// INTEGRATION_DRIVER_REGISTRY, the same pattern storage.module.ts uses for
// AWS_S3/GOOGLE_DRIVE. See google-workspace-admin-health-check.driver.ts's
// own doc comment for why this is a new providerCode rather than reusing
// GOOGLE_DRIVE or any Calendar/Contacts row.
INTEGRATION_DRIVER_REGISTRY['GOOGLE_WORKSPACE_ADMIN'] = new GoogleWorkspaceAdminHealthCheckDriver();

/**
 * Release IH, Checkpoint E started with the registry only, same minimal
 * shape ContactsModule/CalendarModule/BankIntegrationModule all started
 * with at their own first checkpoint.
 *
 * Checkpoint G added the credential shape + health-check driver above.
 *
 * Checkpoint H adds the first (and so far only) concrete provider,
 * GoogleWorkspaceAdminProvider — a real Nest provider (constructor-
 * injecting IntegrationsService + WorkspaceAdminProviderRegistry)
 * self-registering via onModuleInit(), the identical shape
 * MicrosoftGraphContactsProvider/GoogleContactsProvider used for
 * ContactsProviderRegistry. Needs IntegrationsModule imported for the
 * same reason ContactsModule/CalendarModule/StorageModule all do — the
 * concrete provider resolves real credentials through IntegrationsService.
 *
 * Checkpoint I adds WorkspaceAdminService/WorkspaceAdminController — the
 * generic passthrough layer ContactsService/TasksService already gave
 * their own domains, making create/suspend/delete/list callable at all.
 * Still no *automatic* caller — GoogleWorkspaceAdminProvider's own doc
 * comment's still-open question (should CandidateService.hire()
 * auto-provision a directory user on offer acceptance?) remains for its
 * own later checkpoint; this one only exposes the manual REST surface,
 * the same relationship ContactsService has to CandidateService's own
 * separate, hardcoded Outlook-contact sync.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [WorkspaceAdminProviderRegistry, GoogleWorkspaceAdminProvider, WorkspaceAdminService],
  controllers: [WorkspaceAdminController],
  exports: [WorkspaceAdminProviderRegistry],
})
export class WorkspaceAdminModule {}
