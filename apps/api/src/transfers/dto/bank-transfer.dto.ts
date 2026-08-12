import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBankTransferRecordDto {
  @IsString()
  entityId!: string;

  @IsString()
  providerCode!: string;

  @IsString()
  reference!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  recipientAccountNumber!: string;

  @IsString()
  recipientBankCode!: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  narration?: string;
}
