import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// ---- Tenants ----

export class CreateTenantDto {
  @IsString()
  entityId!: string;

  @IsString()
  customerId!: string;

  @IsString()
  unitId!: string;

  @IsDateString()
  moveInDate!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class EndTenancyDto {
  @IsDateString()
  moveOutDate!: string;
}

// ---- Leases ----

export class CreateLeaseDto {
  @IsString()
  entityId!: string;

  @IsString()
  tenantId!: string;

  @IsString()
  unitId!: string;

  @IsString()
  leaseNumber!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsNumber()
  @Min(0)
  rentAmount!: number;

  @IsOptional()
  @IsIn(['MONTHLY', 'QUARTERLY', 'ANNUALLY'])
  rentFrequency?: 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;
}

export class RenewLeaseDto {
  @IsDateString()
  newEndDate!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  newRentAmount?: number;
}

export class TerminateLeaseDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsDateString()
  terminatedAt?: string;
}

// ---- Rent invoicing (thin wrapper around AccountsReceivableService) ----

export class GenerateRentInvoiceDto {
  @IsString()
  invoiceNumber!: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // GL revenue account credited for the rent line — same convention as
  // CreateARInvoiceLineDto.accountId.
  @IsString()
  revenueAccountId!: string;
}

export class PostRentInvoiceDto {
  @IsString()
  arControlAccountId!: string;
}
