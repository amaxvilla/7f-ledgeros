import { IsNumber, IsString, Min } from 'class-validator';

export class TransferBudgetDto {
  @IsString()
  fromLineId!: string;

  @IsString()
  toLineId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  reason!: string;
}
