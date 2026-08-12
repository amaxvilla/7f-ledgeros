import { IsString } from 'class-validator';

export class RemitTaxDeductionDto {
  // GL cash/bank account credited for the cash paid over to the tax
  // authority when remitting a previously withheld amount.
  @IsString()
  cashGlAccountId!: string;
}
