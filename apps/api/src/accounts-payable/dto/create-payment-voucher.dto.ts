import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class PaymentAllocationDto {
  @IsString()
  vendorInvoiceId!: string;

  // Gross amount of this invoice being settled by the voucher. May be
  // less than the invoice's open balance to support partial payment.
  @IsNumber()
  @Min(0.01)
  amountAllocated!: number;

  // Optional withholding — rate as a decimal fraction (e.g. 0.05 = 5%).
  // Not computed automatically: rates vary by vendor/jurisdiction/tax
  // type and are not hardcoded here.
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  whtRate?: number;

  @IsOptional()
  @IsString()
  whtTaxAuthorityAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  vatRate?: number;

  @IsOptional()
  @IsString()
  vatTaxAuthorityAccountId?: string;

  // Release (Tax Center Core follow-up, additive). If set, the rate and
  // tax authority account are resolved from this TaxCode instead of the
  // manual whtRate/whtTaxAuthorityAccountId fields above — those manual
  // fields still work exactly as before when no *TaxCodeId is supplied.
  @IsOptional()
  @IsString()
  whtTaxCodeId?: string;

  @IsOptional()
  @IsString()
  vatTaxCodeId?: string;
}

export class CreatePaymentVoucherDto {
  @IsString()
  entityId!: string;

  @IsString()
  voucherNumber!: string;

  @IsString()
  vendorId!: string;

  @IsOptional()
  @IsString()
  batchId?: string;

  @IsDateString()
  paymentDate!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsString()
  bankAccountId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A payment voucher needs at least one invoice allocation' })
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationDto)
  allocations!: PaymentAllocationDto[];
}
