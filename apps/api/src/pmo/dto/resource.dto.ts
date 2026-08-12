import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ResourceType } from '@prisma/client';

// ---- Resources ----

export class CreateResourceDto {
  @IsString()
  projectId!: string;

  @IsString()
  entityId!: string;

  @IsEnum(ResourceType)
  type!: ResourceType;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  unitOfMeasure?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

// ---- Allocations ----

export class CreateAllocationDto {
  @IsString()
  resourceId!: string;

  @IsString()
  taskId!: string;

  @IsString()
  entityId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0)
  plannedQuantity!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompleteAllocationDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualQuantity?: number;
}

export class CancelAllocationDto {
  @IsString()
  reason!: string;
}
