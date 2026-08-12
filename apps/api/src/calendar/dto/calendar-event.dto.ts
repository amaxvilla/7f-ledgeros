import { IsArray, IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateCalendarEventDto {
  /** Which registered CalendarProvider to use (e.g. "MS_GRAPH") — see CalendarProviderRegistry. */
  @IsString()
  providerCode!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startTime!: string;

  @IsDateString()
  endTime!: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  attendeeEmails?: string[];

  @IsOptional()
  @IsString()
  location?: string;
}

export class UpdateCalendarEventDto {
  @IsString()
  providerCode!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  attendeeEmails?: string[];

  @IsOptional()
  @IsString()
  location?: string;
}

export class CancelCalendarEventDto {
  @IsString()
  providerCode!: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
