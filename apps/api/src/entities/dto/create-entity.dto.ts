import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateEntityDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  legalName!: string;

  @IsOptional()
  @IsString()
  taxIdentificationNumber?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  fiscalYearStartMonth?: number;

  @IsOptional()
  @IsString()
  parentEntityId?: string;

  @IsOptional()
  @IsBoolean()
  isConsolidationParent?: boolean;
}
