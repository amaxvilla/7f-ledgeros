import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { JournalSourceType } from '@prisma/client';

export class CreateJournalLineDto {
  @IsString()
  accountId!: string;

  @IsNumber()
  @Min(0)
  debit!: number;

  @IsNumber()
  @Min(0)
  credit!: number;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  phaseId?: string;

  @IsOptional()
  @IsString()
  blockId?: string;

  @IsOptional()
  @IsString()
  floorId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  fundingSourceId?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;
}

export class CreateJournalEntryDto {
  @IsString()
  entityId!: string;

  @IsDateString()
  entryDate!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsEnum(JournalSourceType)
  sourceType?: JournalSourceType;

  @IsOptional()
  @IsString()
  sourceReference?: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'A journal entry needs at least two lines to balance' })
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}
