import { IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';
import { IntegrationCategory } from '@prisma/client';

export class CreateIntegrationProviderDto {
  @IsOptional()
  @IsString()
  entityId?: string;

  @IsEnum(IntegrationCategory)
  category!: IntegrationCategory;

  @IsString()
  providerCode!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  /** Plaintext secret blob (API key, client secret, ...) — encrypted before it ever reaches the database. */
  @IsOptional()
  @IsObject()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  retryMaxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  retryBackoffMs?: number;
}

export class UpdateIntegrationProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  retryMaxAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  retryBackoffMs?: number;
}

export class RotateIntegrationCredentialsDto {
  @IsObject()
  credentials!: Record<string, unknown>;
}
