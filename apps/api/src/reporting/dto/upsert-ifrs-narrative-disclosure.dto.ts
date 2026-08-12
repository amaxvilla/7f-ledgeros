import { IsString, MinLength } from 'class-validator';

export class UpsertIfrsNarrativeDisclosureDto {
  @IsString()
  @MinLength(1)
  content!: string;
}
