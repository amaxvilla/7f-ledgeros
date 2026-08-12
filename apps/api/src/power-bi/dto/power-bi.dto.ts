import { ArrayMinSize, IsArray, IsIn, IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PowerBiColumnDto {
  @IsString()
  name!: string;

  @IsIn(['string', 'number', 'boolean', 'dateTime'])
  dataType!: 'string' | 'number' | 'boolean' | 'dateTime';
}

class PowerBiTableSchemaDto {
  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PowerBiColumnDto)
  columns!: PowerBiColumnDto[];
}

export class PublishDatasetDto {
  /** Which registered PowerBiProvider to use (e.g. "POWER_BI") — see PowerBiProviderRegistry. */
  @IsString()
  providerCode!: string;

  @IsString()
  datasetName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PowerBiTableSchemaDto)
  tables!: PowerBiTableSchemaDto[];
}

export class PushRowsDto {
  @IsString()
  providerCode!: string;

  @IsString()
  tableName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsObject({ each: true })
  rows!: Record<string, unknown>[];
}

export class TriggerRefreshDto {
  @IsString()
  providerCode!: string;
}

export class GetRefreshStatusQueryDto {
  @IsString()
  providerCode!: string;
}

export class GetEmbedConfigQueryDto {
  @IsString()
  providerCode!: string;
}
