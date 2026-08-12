import { IsArray, IsBoolean, IsEnum, IsHexColor, IsOptional, IsString } from 'class-validator';
import { CurrencySymbolPosition, ThemeMode } from '@prisma/client';

export class UpsertBrandingProfileDto {
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsOptional()
  @IsEnum(ThemeMode)
  themeMode?: ThemeMode;

  @IsOptional()
  @IsBoolean()
  whiteLabelEnabled?: boolean;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedLanguages?: string[];

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  decimalSeparator?: string;

  @IsOptional()
  @IsString()
  thousandsSeparator?: string;

  @IsOptional()
  @IsEnum(CurrencySymbolPosition)
  currencySymbolPosition?: CurrencySymbolPosition;
}
