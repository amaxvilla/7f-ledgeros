import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class ReserveUnitRequestDto {
  @IsString()
  unitId!: string;

  @IsString()
  customerId!: string;

  @IsString()
  entityId!: string;

  @IsString()
  projectId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reservationFee?: number;
}

export class CancelReservationDto {
  @IsString()
  reason!: string;
}

export class ConvertReservationRequestDto {
  @IsNumber()
  @IsPositive()
  salePrice!: number;

  @IsString()
  allocationDate!: string;

  @IsString()
  invoiceNumber!: string;

  @IsString()
  revenueAccountId!: string;

  @IsString()
  arControlAccountId!: string;
}

export class CancelAllocationDto {
  @IsString()
  reason!: string;
}

export class TransferAllocationDto {
  @IsString()
  newCustomerId!: string;

  @IsString()
  reason!: string;
}

export class SwapUnitDto {
  @IsString()
  newUnitId!: string;

  @IsString()
  reason!: string;
}
