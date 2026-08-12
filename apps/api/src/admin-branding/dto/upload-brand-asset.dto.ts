import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { BrandAssetType } from '@prisma/client';

export class UploadBrandAssetDto {
  @IsEnum(BrandAssetType)
  assetType!: BrandAssetType;

  @IsString()
  label!: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isDefault?: boolean;
}
