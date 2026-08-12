import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ThemeMode } from '@prisma/client';

export class UpsertUserPreferenceDto {
  @IsOptional()
  @IsEnum(ThemeMode)
  theme?: ThemeMode;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
