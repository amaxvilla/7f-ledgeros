import { IsDateString } from 'class-validator';

export class ImportMonoStatementDto {
  /** ISO date, inclusive. */
  @IsDateString()
  fromDate!: string;

  /** ISO date, inclusive. */
  @IsDateString()
  toDate!: string;
}
