import { Module } from '@nestjs/common';
import { TeamsProviderRegistry } from './teams-provider.registry';
import { MicrosoftTeamsProvider } from './providers/microsoft-teams.provider';
import { TeamsService } from './teams.service';
import { TeamsController } from './teams.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Release IG.1, Checkpoint Q started with the registry only, same
 * minimal shape CalendarModule/ContactsModule/TasksModule/PresenceModule
 * all started with at their own first checkpoint.
 *
 * Release IG.1, Checkpoint R added the first concrete provider —
 * MicrosoftTeamsProvider.
 *
 * Release IG.1, Checkpoint S adds TeamsService/TeamsController — the
 * same gap ContactsService/ContactsController and
 * TasksService/TasksController closed for their own modules. Same scope
 * decision: no Prisma persistence, and no opinion on which flow should
 * actually create a Teams meeting — see TeamsService's own doc comment
 * and teams-provider.interface.ts's design notes for why wiring this
 * into InterviewService (the most likely caller, for remote/video-call
 * interviews) is still a later checkpoint's decision, not this one's.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [TeamsProviderRegistry, MicrosoftTeamsProvider, TeamsService],
  controllers: [TeamsController],
  exports: [TeamsProviderRegistry, TeamsService],
})
export class TeamsModule {}
