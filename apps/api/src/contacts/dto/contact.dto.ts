import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateContactDto {
  /** Which registered ContactsProvider to use (e.g. "MS_GRAPH", "GOOGLE") — see ContactsProviderRegistry. */
  @IsString()
  providerCode!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsEmail()
  emailAddress?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}

export class UpdateContactDto {
  @IsString()
  providerCode!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsEmail()
  emailAddress?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;
}

export class DeleteContactDto {
  @IsString()
  providerCode!: string;
}
