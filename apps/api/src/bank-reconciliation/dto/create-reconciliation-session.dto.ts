import { IsDateString, IsString } from 'class-validator';

export class CreateReconciliationSessionDto {
  @IsString()
  entityId!: string;

  @IsString()
  bankAccountId!: string;

  @IsString()
  statementId!: string;

  @IsString()
  bankGlAccountId!: string;

  @IsDateString()
  sessionDate!: string;
}
