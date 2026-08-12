import { IsString } from 'class-validator';

export class ActivateAccountDto {
  @IsString()
  entityId!: string;

  @IsString()
  accountId!: string;
}
