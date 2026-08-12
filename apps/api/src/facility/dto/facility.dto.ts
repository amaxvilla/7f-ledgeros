import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// ---- Facilities ----

const FACILITY_CATEGORIES = ['MECHANICAL', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'SECURITY', 'STRUCTURAL', 'AMENITY', 'OTHER'] as const;
type FacilityCategoryValue = (typeof FACILITY_CATEGORIES)[number];

export class CreateFacilityDto {
  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsString()
  name!: string;

  @IsIn(FACILITY_CATEGORIES)
  category!: FacilityCategoryValue;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsDateString()
  installDate?: string;

  @IsOptional()
  @IsDateString()
  nextServiceDueAt?: string;
}

export class RecordServiceDto {
  @IsDateString()
  servicedAt!: string;

  @IsOptional()
  @IsDateString()
  nextServiceDueAt?: string;
}

export class SetOutOfServiceDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

/** Decommissioning a Facility goes through the Workflow Engine — see
 *  FacilityService.requestDecommission()/refreshDecommission(), same
 *  submit/refresh shape as MortgageService. */
export class RequestDecommissionDto {
  @IsString()
  reason!: string;
}

// ---- Maintenance Requests ----

const MAINTENANCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
type MaintenancePriorityValue = (typeof MAINTENANCE_PRIORITIES)[number];

const MAINTENANCE_SOURCES = ['TENANT_REPORTED', 'FACILITY_INSPECTION', 'INTERNAL'] as const;
type MaintenanceSourceValue = (typeof MAINTENANCE_SOURCES)[number];

export class CreateMaintenanceRequestDto {
  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  facilityId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsIn(FACILITY_CATEGORIES)
  category!: FacilityCategoryValue;

  @IsOptional()
  @IsIn(MAINTENANCE_PRIORITIES)
  priority?: MaintenancePriorityValue;

  @IsOptional()
  @IsIn(MAINTENANCE_SOURCES)
  source?: MaintenanceSourceValue;

  @IsString()
  description!: string;

  @IsOptional()
  @IsDateString()
  targetResolutionDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costEstimate?: number;
}

export class AssignMaintenanceRequestDto {
  @IsString()
  vendorId!: string;

  @IsOptional()
  @IsDateString()
  targetResolutionDate?: string;
}

export class HoldMaintenanceRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ResolveMaintenanceRequestDto {
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  actualCost?: number;
}

export class CancelMaintenanceRequestDto {
  @IsString()
  reason!: string;
}

/** Bills the assigned vendor for the completed work by creating a
 *  VendorInvoice through the existing AccountsPayableService — see
 *  MaintenanceService.billVendor(). Posting the invoice to the GL is a
 *  separate, already-existing step (`POST /accounts-payable/invoices/:id/post`)
 *  and is not duplicated here. */
export class BillMaintenanceVendorDto {
  @IsString()
  invoiceNumber!: string;

  @IsDateString()
  invoiceDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsString()
  expenseAccountId!: string;
}
