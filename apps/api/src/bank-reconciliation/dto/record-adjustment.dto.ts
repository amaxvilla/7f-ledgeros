import { IsIn, IsString } from 'class-validator';

export class RecordAdjustmentDto {
  @IsString()
  bankStatementLineId!: string;

  @IsIn(['BANK_CHARGE', 'INTEREST_INCOME'])
  adjustmentType!: 'BANK_CHARGE' | 'INTEREST_INCOME';

  // GL account for the other side of the entry — bank charges expense
  // account, or interest income account. Not hardcoded.
  @IsString()
  contraAccountId!: string;
}
