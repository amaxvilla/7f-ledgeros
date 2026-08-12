import { IsOptional, IsString } from 'class-validator';

export class ManualMatchDto {
  @IsString()
  bankStatementLineId!: string;

  @IsString()
  journalLineId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
