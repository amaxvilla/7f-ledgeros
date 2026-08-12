import { IsString } from 'class-validator';

export class UpsertTranslationDto {
  @IsString()
  locale!: string;

  @IsString()
  namespace!: string;

  @IsString()
  key!: string;

  @IsString()
  value!: string;
}
