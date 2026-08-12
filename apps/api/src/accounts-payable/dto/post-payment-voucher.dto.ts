import { IsString } from 'class-validator';

export class PostPaymentVoucherDto {
  // GL control account debited to reduce the vendor payable.
  @IsString()
  apControlAccountId!: string;

  // GL cash/bank account credited for the net amount actually paid.
  // Treasury's BankAccount record identifies the operational bank
  // account; this is the corresponding GL account for that bank
  // account, supplied explicitly since BankAccount does not itself
  // carry a GL account reference.
  @IsString()
  cashGlAccountId!: string;
}
