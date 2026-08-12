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

export class CreateAPInvoiceLineDto {
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

// Creates a VendorInvoice (the same model Procurement uses) for bills
// with no purchase order — rent, utilities, professional fees, etc.
// purchaseOrderId is intentionally not accepted here: PO-backed invoices
// go through Procurement's PR->PO->GRN->3-way-match flow instead, so
// there is exactly one posting path per invoice.
export class CreateAPInvoiceDto {
  @IsString()
  entityId!: string;

  @IsString()
  invoiceNumber!: string;

  @IsString()
  vendorId!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'An invoice needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => CreateAPInvoiceLineDto)
  lines!: CreateAPInvoiceLineDto[];
}
