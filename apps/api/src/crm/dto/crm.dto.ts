import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CrmActivityType, LeadSource, ProspectStatus } from '@prisma/client';

// ---- Leads ----

export class CreateLeadDto {
  @IsString()
  entityId!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  estateId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;
}

export class AssignLeadDto {
  @IsString()
  assignedToId!: string;
}

export class DisqualifyLeadDto {
  @IsString()
  reason!: string;
}

export class ConvertLeadDto {
  @IsOptional()
  @IsString()
  unitOfInterestId?: string;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;
}

// ---- Prospects ----

export class CreateProspectDto {
  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  estateId?: string;

  @IsOptional()
  @IsString()
  unitOfInterestId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  // Only used when a Prospect is opened directly (no Lead), for a buyer who
  // is already a known Customer (e.g. repeat purchaser).
  @IsOptional()
  @IsString()
  existingCustomerId?: string;
}

export class UpdateProspectStatusDto {
  @IsEnum(ProspectStatus)
  status!: ProspectStatus;
}

export class MarkProspectLostDto {
  @IsString()
  reason!: string;
}

export class ReserveUnitForProspectDto {
  @IsString()
  unitId!: string;

  @IsString()
  entityId!: string;

  @IsString()
  projectId!: string;

  @IsNumber()
  @Min(1)
  expiresInHours!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reservationFee?: number;

  // Required only if this Prospect has no Customer yet.
  @IsOptional()
  @IsString()
  customerCode?: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;
}

// ---- Activities (shared by Lead & Prospect) ----

export class LogActivityDto {
  @IsEnum(CrmActivityType)
  activityType!: CrmActivityType;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}
