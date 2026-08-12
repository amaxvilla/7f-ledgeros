import { IsString } from 'class-validator';

export class PostARInvoiceDto {
  // GL control account debited for the receivable. Not hardcoded —
  // caller supplies the entity's actual AR control account.
  @IsString()
  arControlAccountId!: string;
}
