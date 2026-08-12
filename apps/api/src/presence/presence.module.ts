import { Module } from '@nestjs/common';
import { PresenceProviderRegistry } from './presence-provider.registry';
import { MicrosoftGraphPresenceProvider } from './providers/microsoft-graph-presence.provider';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Release IG.1, Checkpoint N started with the registry only, same
 * minimal shape CalendarModule/ContactsModule/TasksModule/
 * BankIntegrationModule all started with at their own first checkpoint.
 *
 * Release IG.1, Checkpoint O added the first concrete provider —
 * MicrosoftGraphPresenceProvider.
 *
 * Release IG.1, Checkpoint P adds PresenceService/PresenceController —
 * the same gap ContactsService/TasksService/TeamsService closed for
 * their own modules, and the last remaining Microsoft Graph "make the
 * abstraction callable" checkpoint. Same scope decision as its
 * siblings: no Prisma persistence, and no opinion on which screen
 * should actually show a presence indicator — see PresenceService's own
 * doc comment and presence-provider.interface.ts's design notes.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [PresenceProviderRegistry, MicrosoftGraphPresenceProvider, PresenceService],
  controllers: [PresenceController],
  exports: [PresenceProviderRegistry, PresenceService],
})
export class PresenceModule {}
