import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateJournalEntryDto } from './create-journal-entry.dto';

export class BulkCreateJournalEntryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalEntryDto)
  entries!: CreateJournalEntryDto[];
}
