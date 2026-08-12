import { IsString } from 'class-validator';

export class CreateThreeWayMatchDto {
  @IsString()
  purchaseOrderId!: string;

  @IsString()
  grnId!: string;

  @IsString()
  vendorInvoiceId!: string;
}
