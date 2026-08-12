import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { AccountType, AccountCategory } from '@prisma/client';

export class CreateAccountDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(AccountType)
  accountType!: AccountType;

  @IsEnum(AccountCategory)
  accountCategory!: AccountCategory;

  @IsOptional()
  @IsString()
  ifrsMapping?: string;

  @IsOptional()
  @IsBoolean()
  isControlAccount?: boolean;

  @IsOptional()
  @IsBoolean()
  isPostable?: boolean;

  @IsOptional()
  @IsString()
  parentAccountId?: string;
}
