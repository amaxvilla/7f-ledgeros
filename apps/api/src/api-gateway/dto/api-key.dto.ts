import { IsArray, IsDateString, IsInt, IsOptional, IsPositive, IsString } from 'class-validator';

export class GenerateApiKeyDto {
  @IsString()
  entityId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /** API Gateway, Checkpoint B. Omit for unlimited — see ApiKey.rateLimitPerMinute's own schema comment. */
  @IsOptional()
  @IsInt()
  @IsPositive()
  rateLimitPerMinute?: number;
}

export class RevokeApiKeyDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
