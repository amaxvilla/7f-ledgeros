import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BudgetCommitmentSourceType } from '@prisma/client';

export class CreateBudgetCommitmentDto {
  @IsString()
  budgetLineId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsEnum(BudgetCommitmentSourceType)
  sourceType?: BudgetCommitmentSourceType;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ReleaseBudgetCommitmentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
