import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentTemplateType } from '@prisma/client';

export class UpsertDocumentTemplateDto {
  // DocumentTemplate.entityId is NOT NULL in the database — every template
  // must belong to a real entity; there is no system-wide default.
  @IsString()
  entityId!: string;

  @IsEnum(DocumentTemplateType)
  templateType!: DocumentTemplateType;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  // Merge-tag markup, e.g. "Dear {{customerName}}, your invoice {{invoiceNumber}}...".
  @IsString()
  content!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
