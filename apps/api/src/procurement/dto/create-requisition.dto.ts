import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRequisitionLineDto {
  @IsString()
  description!: string;

  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  budgetLineId?: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  estimatedUnitCost!: number;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  phaseId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  fundingSourceId?: string;
}

export class CreateRequisitionDto {
  @IsString()
  entityId!: string;

  @IsString()
  prNumber!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  fundingSourceId?: string;

  @IsOptional()
  @IsString()
  justification?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A requisition needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => CreateRequisitionLineDto)
  lines!: CreateRequisitionLineDto[];
}
