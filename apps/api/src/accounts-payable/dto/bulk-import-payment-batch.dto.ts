import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsString, ValidateNested } from 'class-validator';
import { CreatePaymentVoucherDto } from './create-payment-voucher.dto';

export class BulkImportPaymentBatchDto {
  @IsString()
  entityId!: string;

  @IsString()
  batchNumber!: string;

  @IsDateString()
  paymentDate!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentVoucherDto)
  vouchers!: CreatePaymentVoucherDto[];
}
