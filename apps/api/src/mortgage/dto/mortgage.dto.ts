import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateMortgageApplicationDto {
  @IsString()
  allocationId!: string;

  @IsString()
  entityId!: string;

  @IsString()
  lenderName!: string;

  @IsNumber()
  @Min(0)
  amountApplied!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRatePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tenorMonths?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveMortgageDto {
  @IsNumber()
  @Min(0)
  amountApproved!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRatePercent?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  tenorMonths?: number;
}

export class DeclineMortgageDto {
  @IsString()
  reason!: string;
}

export class DisburseMortgageDto {
  @IsString()
  installmentLineId!: string;

  @IsNumber()
  @Min(0)
  disbursedAmount!: number;

  @IsDateString()
  entryDate!: string;

  @IsString()
  bankAccountGlId!: string;

  @IsString()
  deferredRevenueGlId!: string;
}
