import { IsDateString, IsString } from 'class-validator';

export class CreatePaymentBatchDto {
  @IsString()
  entityId!: string;

  @IsString()
  batchNumber!: string;

  @IsDateString()
  paymentDate!: string;
}
