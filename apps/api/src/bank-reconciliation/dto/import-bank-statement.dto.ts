import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class BankStatementLineInputDto {
  @IsDateString()
  transactionDate!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsString()
  reference?: string;

  // Signed: positive = deposit/credit, negative = withdrawal/debit.
  @IsNumber()
  amount!: number;
}

// Accepts already-parsed statement rows. Actual CSV file upload is a
// thin controller-level concern (multipart -> parse -> this same
// shape) left to the client/API-gateway layer; the service only deals
// in structured rows so it's testable without a real file.
export class ImportBankStatementDto {
  @IsString()
  entityId!: string;

  @IsString()
  bankAccountId!: string;

  @IsDateString()
  statementDate!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsNumber()
  openingBalance!: number;

  @IsNumber()
  closingBalance!: number;

  @IsArray()
  @ArrayMinSize(1, { message: 'A statement needs at least one line' })
  @ValidateNested({ each: true })
  @Type(() => BankStatementLineInputDto)
  lines!: BankStatementLineInputDto[];
}
