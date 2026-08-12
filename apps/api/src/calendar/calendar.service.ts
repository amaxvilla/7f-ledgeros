import { Injectable } from '@nestjs/common';
import { CalendarProviderRegistry } from './calendar-provider.registry';
import { CreateCalendarEventDto, UpdateCalendarEventDto, CancelCalendarEventDto } from './dto/calendar-event.dto';

/**
 * Release IG.1, Checkpoint C — the piece CalendarProviderRegistry
 * (Checkpoint A) and MicrosoftGraphCalendarProvider (Checkpoint B) were
 * missing: something that actually calls
 * createEvent/updateEvent/cancelEvent. No Prisma persistence here — a
 * calendar event's provider id is the caller's responsibility to keep
 * (e.g. on whatever domain row the meeting relates to), the same way
 * StorageProvider's `key` is the caller's to keep rather than this
 * layer maintaining its own table of every file ever uploaded.
 *
 * Deliberately synchronous, same reasoning PaymentsService's own doc
 * comment gives for its own methods: a caller creating a calendar
 * invite typically wants the provider's event id / htmlLink back in the
 * same request, not a queued "maybe later."
 */
@Injectable()
export class CalendarService {
  constructor(private readonly registry: CalendarProviderRegistry) {}

  async createEvent(dto: CreateCalendarEventDto) {
    const { providerCode, startTime, endTime, ...rest } = dto;
    return this.registry.get(providerCode).createEvent({
      ...rest,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });
  }

  updateEvent(providerEventId: string, dto: UpdateCalendarEventDto) {
    const { providerCode, startTime, endTime, ...rest } = dto;
    return this.registry.get(providerCode).updateEvent({
      ...rest,
      providerEventId,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
    });
  }

  cancelEvent(providerEventId: string, dto: CancelCalendarEventDto) {
    return this.registry.get(dto.providerCode).cancelEvent({ providerEventId, comment: dto.comment });
  }
}
