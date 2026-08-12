import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseOrderLineDto {
  @IsOptional()
  @IsString()
  requisitionLineId?: string;

  @IsString()
  description!: string;

  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  stockItemId?: string;

  @IsString()
  budgetLineId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

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

export class CreatePurchaseOrderDto {
  @IsString()
  entityId!: string;

  @IsString()
  poNumber!: string;

  @IsOptional()
  @IsString()
  requisitionId?: string;

  @IsString()
  vendorId!: string;

  @IsDateString()
  orderDate!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A purchase order needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];
}
