import { IsDateString, IsString } from 'class-validator';

/** Release IG.1, Checkpoint S. Field names mirror CreateMeetingParams (teams-provider.interface.ts) exactly. */
export class CreateMeetingDto {
  /** Which registered TeamsProvider to use (e.g. "MS_GRAPH") — see TeamsProviderRegistry. */
  @IsString()
  providerCode!: string;

  @IsString()
  subject!: string;

  /** ISO 8601 — converted to a Date before being passed to the provider, same string-to-Date boundary CalendarService/TasksService both draw at their own DTOs. */
  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  /** Not assumed to be a 7F LedgerOS User.id — see CreateMeetingParams's own organizerIdentifier design note. */
  @IsString()
  organizerIdentifier!: string;
}

export class CancelMeetingDto {
  @IsString()
  providerCode!: string;

  @IsString()
  organizerIdentifier!: string;
}
