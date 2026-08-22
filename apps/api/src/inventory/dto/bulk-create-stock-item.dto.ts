import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsString, ValidateNested, IsEnum } from 'class-validator';
import { InventoryDomain } from '@prisma/client';

export class StockItemDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(InventoryDomain)
  domain!: InventoryDomain;

  @IsString()
  unitOfMeasure!: string;
}

export class BulkCreateStockItemDto {
  @IsString()
  entityId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockItemDto)
  items!: StockItemDto[];
}
