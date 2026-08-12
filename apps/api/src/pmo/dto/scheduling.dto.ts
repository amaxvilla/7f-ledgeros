import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ProjectTaskStatus, TaskDependencyType } from '@prisma/client';

export class CreateProjectTaskDto {
  @IsString()
  projectId!: string;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isMilestone?: boolean;

  @IsDateString()
  plannedStart!: string;

  @IsDateString()
  plannedEnd!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetedCost?: number;
}

export class UpdateTaskProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  percentComplete!: number;

  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCost?: number;
}

export class SetTaskStatusDto {
  @IsEnum(ProjectTaskStatus)
  status!: ProjectTaskStatus;
}

export class CreateTaskDependencyDto {
  @IsString()
  predecessorId!: string;

  @IsString()
  successorId!: string;

  @IsOptional()
  @IsEnum(TaskDependencyType)
  type?: TaskDependencyType;

  @IsOptional()
  @IsInt()
  lagDays?: number;
}
