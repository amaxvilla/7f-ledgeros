import { IsOptional, IsString, MinLength } from 'class-validator';

export class ValidateBankAccountDto {
  @IsString()
  @MinLength(1)
  accountNumber!: string;

  @IsString()
  @MinLength(1)
  bankCode!: string;

  /**
   * Which BankProviderRegistry entry to validate against. Defaults to
   * "PAYSTACK" — the general-purpose NIBSS-style arbitrary lookup (see
   * PaystackBankProvider's own doc comment). Passing "MONO" instead asks
   * a semantically different question per MonoProvider's Checkpoint F
   * re-scoping: not "does this account number/bank code pair exist",
   * but "is this specific accountNumber currently linked via an ACTIVE
   * MonoLinkedAccount". Both are valid uses of the same
   * BankProvider.validateAccount() method; callers should pick
   * deliberately, not assume they're interchangeable.
   */
  @IsOptional()
  @IsString()
  providerCode?: string;
}
