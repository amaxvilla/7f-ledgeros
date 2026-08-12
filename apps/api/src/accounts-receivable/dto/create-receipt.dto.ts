import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ReceiptAllocationDto {
  @IsString()
  arInvoiceId!: string;

  @IsNumber()
  @Min(0.01)
  amountAllocated!: number;
}

export class CreateReceiptDto {
  @IsString()
  entityId!: string;

  @IsString()
  receiptNumber!: string;

  @IsString()
  customerId!: string;

  @IsDateString()
  receiptDate!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsString()
  bankAccountId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A receipt needs at least one invoice allocation' })
  @ValidateNested({ each: true })
  @Type(() => ReceiptAllocationDto)
  allocations!: ReceiptAllocationDto[];
}
