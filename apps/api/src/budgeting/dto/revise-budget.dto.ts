import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from 'class-validator';

export class ReviseBudgetLineDto {
  @IsString()
  budgetLineId!: string;

  @IsNumber()
  @Min(0)
  newAmount!: number;
}

export class ReviseBudgetDto {
  @IsString()
  reason!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A revision needs at least one changed line' })
  @ValidateNested({ each: true })
  @Type(() => ReviseBudgetLineDto)
  lines!: ReviseBudgetLineDto[];
}
