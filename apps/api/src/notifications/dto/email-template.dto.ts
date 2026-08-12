import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  subjectTemplate!: string;

  @IsOptional()
  @IsString()
  htmlTemplate?: string;

  @IsString()
  textTemplate!: string;

  /** Documents expected {{variable}} names — informational, see EmailTemplate.variables doc comment. */
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}

export class UpdateEmailTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  subjectTemplate?: string;

  @IsOptional()
  @IsString()
  htmlTemplate?: string;

  @IsOptional()
  @IsString()
  textTemplate?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RenderEmailTemplateDto {
  @IsObject()
  variables!: Record<string, string>;
}
