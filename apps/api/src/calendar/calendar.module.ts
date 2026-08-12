import { Module } from '@nestjs/common';
import { CalendarProviderRegistry } from './calendar-provider.registry';
import { MicrosoftGraphCalendarProvider } from './providers/microsoft-graph-calendar.provider';
import { GoogleCalendarProvider } from './providers/google-calendar.provider';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Release IG.1, Checkpoint A. Registry only, same minimal shape
 * BankIntegrationModule started with at its own Checkpoint A.
 *
 * Release IG.1, Checkpoint B adds the first concrete provider —
 * MicrosoftGraphCalendarProvider — as a real Nest provider
 * (constructor-injecting IntegrationsService + CalendarProviderRegistry)
 * self-registering via onModuleInit(), exactly like
 * PaystackProvider/MonoProvider/PaystackBankProvider before it.
 *
 * Release IG.1, Checkpoint C adds CalendarService/CalendarController —
 * the caller createEvent/updateEvent/cancelEvent were missing. No new
 * Prisma model: a calendar event's providerEventId is the caller's own
 * responsibility to persist against whatever domain record it relates
 * to, the same way a Storage upload's `key` is the caller's to keep.
 *
 * Release IH (Google Workspace), Checkpoint A adds GoogleCalendarProvider
 * — the second concrete provider, registering into the exact same
 * CalendarProviderRegistry under 'GOOGLE_CALENDAR'. No changes to
 * CalendarService/CalendarController were needed: both already dispatch
 * by `providerCode` generically (see CalendarService's own doc
 * comment), which is precisely the point of the registry existing.
 */
@Module({
  imports: [IntegrationsModule],
  providers: [CalendarProviderRegistry, MicrosoftGraphCalendarProvider, GoogleCalendarProvider, CalendarService],
  controllers: [CalendarController],
  exports: [CalendarProviderRegistry, CalendarService],
})
export class CalendarModule {}
