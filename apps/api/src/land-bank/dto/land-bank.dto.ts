import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PlotUseType, TitleType } from '@prisma/client';

// ---- Land Parcels ----

export class CreateLandParcelDto {
  @IsString()
  entityId!: string;

  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  stateProvince?: string;

  @IsOptional()
  @IsString()
  localGovernmentArea?: string;

  @IsNumber()
  @IsPositive()
  areaSqm!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  acquisitionCostBudget?: number;
}

// ---- Land Acquisitions ----

export class RecordLandAcquisitionDto {
  @IsString()
  parcelId!: string;

  @IsString()
  vendorName!: string;

  @IsOptional()
  @IsString()
  vendorContact?: string;

  @IsNumber()
  @IsPositive()
  agreedPrice!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  dueDiligenceNotes?: string;
}

export class CompleteLandAcquisitionDto {
  @IsString()
  acquisitionDate!: string;
}

// ---- Titles ----

export class AddTitleDeedDto {
  @IsString()
  parcelId!: string;

  @IsEnum(TitleType)
  titleType!: TitleType;

  @IsOptional()
  @IsString()
  titleNumber?: string;

  @IsOptional()
  @IsString()
  issuingAuthority?: string;

  @IsOptional()
  @IsString()
  applicationDate?: string;

  @IsOptional()
  @IsString()
  documentRef?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PerfectTitleDeedDto {
  @IsString()
  issuedDate!: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  titleNumber?: string;
}

export class RejectTitleDeedDto {
  @IsString()
  reason!: string;
}

// ---- Survey Plans ----

export class CreateSurveyPlanDto {
  @IsString()
  parcelId!: string;

  @IsString()
  planNumber!: string;

  @IsOptional()
  @IsString()
  surveyorName?: string;

  @IsOptional()
  @IsString()
  surveyDate?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  areaSqm?: number;

  @IsOptional()
  @IsObject()
  coordinates?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  documentRef?: string;
}

export class ApproveSurveyPlanDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectSurveyPlanDto {
  @IsString()
  reason!: string;
}

// ---- Plots ----

export class SubdivideParcelDto {
  @IsString()
  surveyPlanId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PlotDefinitionDto)
  plots!: PlotDefinitionDto[];
}

export class PlotDefinitionDto {
  @IsString()
  plotNumber!: string;

  @IsNumber()
  @IsPositive()
  areaSqm!: number;

  @IsOptional()
  @IsEnum(PlotUseType)
  useType?: PlotUseType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePlotStatusDto {
  @IsString()
  status!: string;
}

// ---- Estate Master Planning ----

export class MasterPlanZoneDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(PlotUseType)
  useType!: PlotUseType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedAreaSqm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedUnitCount?: number;
}

export class CreateMasterPlanDto {
  @IsString()
  estateId!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPlannedUnits?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MasterPlanZoneDto)
  zones?: MasterPlanZoneDto[];
}

// ---- Plot -> Project Release ----

export class ReleasePlotDto {
  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelPlotReleaseDto {
  @IsString()
  reason!: string;
}
