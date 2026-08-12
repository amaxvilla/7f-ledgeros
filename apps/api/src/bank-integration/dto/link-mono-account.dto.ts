import { IsString, MinLength } from 'class-validator';

export class LinkMonoAccountDto {
  /** The short-lived, single-use code the Mono Connect widget returns to the frontend on successful consent. */
  @IsString()
  @MinLength(1)
  code!: string;

  /** The internal BankAccount this Mono-linked account represents. */
  @IsString()
  @MinLength(1)
  bankAccountId!: string;
}
