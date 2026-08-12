import { IsString } from 'class-validator';

export class PostAPInvoiceDto {
  // GL control account credited for the vendor liability. Not
  // hardcoded — caller supplies the entity's actual AP control account,
  // same convention used across Procurement and Revenue Recognition.
  @IsString()
  apControlAccountId!: string;
}
