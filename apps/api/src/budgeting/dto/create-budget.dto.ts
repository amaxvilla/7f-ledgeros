import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateBudgetLineDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  phaseId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  costCenterId?: string;

  @IsOptional()
  @IsString()
  fundingSourceId?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  period!: number;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CreateBudgetDto {
  @IsString()
  entityId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsInt()
  fiscalYear!: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A budget needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => CreateBudgetLineDto)
  lines!: CreateBudgetLineDto[];
}
