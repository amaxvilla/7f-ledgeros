import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

/** Release IG.1, Checkpoint M. Field names/optionality mirror TaskParams (tasks-provider.interface.ts) exactly. */
export class CreateTaskDto {
  /** Which registered TasksProvider to use (e.g. "MS_GRAPH") — see TasksProviderRegistry. */
  @IsString()
  providerCode!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  /** ISO 8601 — converted to a Date before being passed to the provider, same as CalendarService does for its own startTime/endTime. */
  @IsOptional()
  @IsDateString()
  dueDateTime?: string;

  @IsOptional()
  @IsString()
  listId?: string;
}

export class UpdateTaskDto {
  @IsString()
  providerCode!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  dueDateTime?: string;

  @IsOptional()
  @IsString()
  listId?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}

export class DeleteTaskDto {
  @IsString()
  providerCode!: string;

  @IsOptional()
  @IsString()
  listId?: string;
}
