import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateDirectoryUserDto {
  /** Which registered WorkspaceAdminProvider to use (e.g. "GOOGLE_WORKSPACE_ADMIN") — see WorkspaceAdminProviderRegistry. */
  @IsString()
  providerCode!: string;

  @IsEmail()
  primaryEmail!: string;

  @IsString()
  givenName!: string;

  @IsString()
  familyName!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  orgUnitPath?: string;
}

export class SuspendDirectoryUserDto {
  @IsString()
  providerCode!: string;

  @IsBoolean()
  suspended!: boolean;
}

export class DeleteDirectoryUserDto {
  @IsString()
  providerCode!: string;
}
