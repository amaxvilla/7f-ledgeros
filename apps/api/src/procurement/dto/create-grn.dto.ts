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

export class CreateGRNLineDto {
  @IsString()
  purchaseOrderLineId!: string;

  @IsNumber()
  @Min(0.0001)
  quantityReceived!: number;

  // Optional override; defaults to the PO line's unitCost when omitted.
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;
}

export class CreateGRNDto {
  @IsString()
  entityId!: string;

  @IsString()
  grnNumber!: string;

  @IsString()
  purchaseOrderId!: string;

  @IsString()
  warehouseId!: string;

  @IsDateString()
  receiptDate!: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  // GL account for the GR/IR (goods-received-not-invoiced) clearing
  // liability created by this receipt. Not hardcoded — the caller
  // supplies the entity's actual clearing account.
  @IsString()
  grIrClearingAccountId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A goods receipt needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => CreateGRNLineDto)
  lines!: CreateGRNLineDto[];
}
