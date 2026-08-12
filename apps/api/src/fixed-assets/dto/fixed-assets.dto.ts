import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateAssetCategoryDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  defaultUsefulLifeYears!: number;

  @IsString()
  assetAccountId!: string;

  @IsString()
  accumulatedDepreciationAccountId!: string;

  @IsString()
  depreciationExpenseAccountId!: string;
}

export class CreateFixedAssetDto {
  @IsString()
  entityId!: string;

  @IsString()
  assetCategoryId!: string;

  @IsString()
  assetTag!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  acquisitionDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  acquisitionCost!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  residualValue?: number;

  @IsInt()
  @Min(1)
  usefulLifeYears!: number;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  locationName?: string;
}

export class RunDepreciationDto {
  @IsDateString()
  periodDate!: string; // any date within the month being depreciated

  @IsOptional()
  @IsString()
  entityId?: string; // if omitted, runs across every eligible entity

  @IsString()
  systemUserId!: string; // who the posted journal entries are attributed to
}

export class DisposeAssetDto {
  @IsDateString()
  disposalDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  disposalProceeds!: number;

  @IsString()
  disposalProceedsGlAccountId!: string; // e.g. bank/cash account receiving the proceeds

  @IsString()
  gainLossGlAccountId!: string; // P&L account absorbing gain/loss on disposal

  @IsString()
  disposedById!: string;
}
