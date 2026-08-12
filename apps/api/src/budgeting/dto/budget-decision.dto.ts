import { IsOptional, IsString } from 'class-validator';

export class BudgetDecisionDto {
  @IsOptional()
  @IsString()
  comments?: string;
}
