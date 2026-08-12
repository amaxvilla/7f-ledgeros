import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  // Release N — Trusted Devices. Raw token previously issued by
  // trustCurrentDevice(); if it matches an unrevoked, unexpired
  // TrustedDevice for this user, the MFA challenge step is skipped.
  @IsOptional()
  @IsString()
  deviceToken?: string;
}
