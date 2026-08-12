import { Injectable } from '@nestjs/common';
import { TeamsProviderRegistry } from './teams-provider.registry';
import { CreateMeetingDto, CancelMeetingDto } from './dto/teams.dto';

/**
 * Release IG.1, Checkpoint S.
 *
 * The piece TeamsProviderRegistry and MicrosoftTeamsProvider were
 * missing: something that actually calls createMeeting/cancelMeeting.
 * Mirrors ContactsService/TasksService exactly, including their scope
 * decision: no Prisma persistence, and no opinion on which of this
 * codebase's flows should actually create a Teams meeting (most likely
 * InterviewService, for a remote/video-call interview — see
 * teams-provider.interface.ts's own design notes) — that wiring is
 * explicitly deferred to a later checkpoint, same as Calendar's own
 * Interview integration was a distinct checkpoint after Calendar's
 * generic service/controller existed. This layer only makes
 * create/cancel callable at all.
 *
 * startTime/endTime arrive as ISO strings (DTO validation) and are
 * converted to real Dates here before reaching TeamsProvider — the same
 * boundary CalendarService/TasksService both draw for their own
 * Date-typed fields.
 */
@Injectable()
export class TeamsService {
  constructor(private readonly registry: TeamsProviderRegistry) {}

  async createMeeting(dto: CreateMeetingDto) {
    const { providerCode, startTime, endTime, ...rest } = dto;
    return this.registry.get(providerCode).createMeeting({
      ...rest,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
    });
  }

  cancelMeeting(providerMeetingId: string, dto: CancelMeetingDto) {
    return this.registry.get(dto.providerCode).cancelMeeting({
      providerMeetingId,
      organizerIdentifier: dto.organizerIdentifier,
    });
  }
}
