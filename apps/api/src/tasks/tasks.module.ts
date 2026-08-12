import { Module } from '@nestjs/common';
import { TasksProviderRegistry } from './tasks-provider.registry';
import { MicrosoftGraphTasksProvider } from './providers/microsoft-graph-tasks.provider';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Release IG.1, Checkpoint K started with the registry only, same
 * minimal shape CalendarModule/ContactsModule/BankIntegrationModule all
 * started with at their own first checkpoint.
 *
 * Release IG.1, Checkpoint L added the first concrete provider —
 * MicrosoftGraphTasksProvider.
 *
 * Release IG.1, Checkpoint M adds TasksService/TasksController — the
 * same gap ContactsService/ContactsController closed for Contacts. Same
 * scope decision: no Prisma persistence, and no opinion on which
 * existing task-like record should sync as a Microsoft To Do task — see
 * TasksService's own doc comment and tasks-provider.interface.ts's
 * design notes for why that's still a later checkpoint's decision, not
 * this one's.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [TasksProviderRegistry, MicrosoftGraphTasksProvider, TasksService],
  controllers: [TasksController],
  exports: [TasksProviderRegistry, TasksService],
})
export class TasksModule {}
