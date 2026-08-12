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

export class CreateARInvoiceLineDto {
  @IsString()
  description!: string;

  @IsString()
  accountId!: string;

  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  phaseId?: string;

  // Release L — Output VAT on AR Invoices (additive). If set, resolved
  // to a rate + tax-authority account from TaxCode at invoice-creation
  // time and snapshotted onto the line — see ARInvoiceLine's schema doc
  // comment. Omit for a non-taxed line (existing behavior, unchanged).
  @IsOptional()
  @IsString()
  vatTaxCodeId?: string;
}

export class CreateARInvoiceDto {
  @IsString()
  entityId!: string;

  @IsString()
  invoiceNumber!: string;

  @IsString()
  customerId!: string;

  @IsOptional()
  @IsString()
  allocationId?: string;

  @IsDateString()
  invoiceDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'An invoice needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => CreateARInvoiceLineDto)
  lines!: CreateARInvoiceLineDto[];
}
