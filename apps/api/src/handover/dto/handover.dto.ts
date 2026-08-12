import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { SnagSeverity, SnagSource } from '@prisma/client';

export class ScheduleHandoverDto {
  @IsString()
  allocationId!: string;

  @IsString()
  entityId!: string;

  @IsString()
  unitId!: string;

  @IsString()
  customerId!: string;

  @IsDateString()
  scheduledDate!: string;
}

export class CancelHandoverDto {
  @IsString()
  reason!: string;
}

export class AddSnagDto {
  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(SnagSeverity)
  severity?: SnagSeverity;

  @IsOptional()
  @IsEnum(SnagSource)
  source?: SnagSource;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class ResolveSnagDto {
  @IsOptional()
  @IsString()
  resolvedNotes?: string;
}

export class RejectSnagDto {
  @IsString()
  reason!: string;
}

/** GL identifiers needed to reuse RevenueRecognitionService.recognizeOnHandover() as-is. */
export class CompleteHandoverDto {
  @IsDateString()
  entryDate!: string;

  @IsNumber()
  @Min(0)
  salePrice!: number;

  @IsNumber()
  @Min(0)
  costOfUnit!: number;

  @IsString()
  deferredRevenueGlId!: string;

  @IsString()
  propertySalesRevenueGlId!: string;

  @IsString()
  costOfSalesGlId!: string;

  @IsString()
  propertyInventoryGlId!: string;
}
