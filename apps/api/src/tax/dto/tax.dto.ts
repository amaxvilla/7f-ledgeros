import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTaxCodeDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsIn(['WHT', 'VAT'])
  taxType!: 'WHT' | 'VAT';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rate!: number;

  @IsOptional()
  @IsString()
  jurisdiction?: string;

  @IsString()
  taxAuthorityAccountId!: string;
}

export class TaxPositionQueryDto {
  @IsString()
  entityId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;
}

export class RemitTaxPeriodDto {
  @IsString()
  entityId!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsIn(['WHT', 'VAT'])
  taxType!: 'WHT' | 'VAT';

  @IsString()
  cashGlAccountId!: string;
}
