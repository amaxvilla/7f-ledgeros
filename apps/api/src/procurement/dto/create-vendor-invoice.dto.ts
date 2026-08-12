import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateVendorInvoiceLineDto {
  @IsOptional()
  @IsString()
  purchaseOrderLineId?: string;

  @IsString()
  description!: string;

  @IsString()
  accountId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreateVendorInvoiceDto {
  @IsString()
  entityId!: string;

  @IsString()
  invoiceNumber!: string;

  @IsString()
  vendorId!: string;

  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @IsDateString()
  invoiceDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A vendor invoice needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => CreateVendorInvoiceLineDto)
  lines!: CreateVendorInvoiceLineDto[];
}
