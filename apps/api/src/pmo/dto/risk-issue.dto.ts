import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { IssuePriority, RiskImpact, RiskProbability } from '@prisma/client';

// ---- Risks ----

export class CreateRiskDto {
  @IsString()
  projectId!: string;

  @IsString()
  entityId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(RiskProbability)
  probability?: RiskProbability;

  @IsOptional()
  @IsEnum(RiskImpact)
  impact?: RiskImpact;

  @IsOptional()
  @IsString()
  ownerId?: string;
}

export class AssessRiskDto {
  @IsEnum(RiskProbability)
  probability!: RiskProbability;

  @IsEnum(RiskImpact)
  impact!: RiskImpact;
}

export class SetMitigationPlanDto {
  @IsString()
  mitigationPlan!: string;
}

export class AssignRiskOwnerDto {
  @IsString()
  ownerId!: string;
}

export class ConvertRiskToIssueDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

// ---- Issues ----

export class CreateIssueDto {
  @IsString()
  projectId!: string;

  @IsString()
  entityId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(IssuePriority)
  priority?: IssuePriority;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class AssignIssueDto {
  @IsString()
  assignedToId!: string;
}

export class ResolveIssueDto {
  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
