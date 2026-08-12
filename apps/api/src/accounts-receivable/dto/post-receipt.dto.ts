import { IsString } from 'class-validator';

export class PostReceiptDto {
  @IsString()
  arControlAccountId!: string;

  // GL account for the receipt's bank account (BankAccount itself
  // carries no GL account reference — same convention as AP).
  @IsString()
  cashGlAccountId!: string;
}
