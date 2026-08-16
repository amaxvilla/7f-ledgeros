import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'admin@7fifteencapital.com',
    description: 'User email address',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'ChangeMe!2026',
    minLength: 8,
    description: 'User password',
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    description: 'Previously issued trusted-device token used to bypass MFA',
  })
  @IsOptional()
  @IsString()
  deviceToken?: string;
}
