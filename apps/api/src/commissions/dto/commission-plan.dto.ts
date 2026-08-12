import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CommissionPlanType, CommissionPlanScope } from '@prisma/client';

export class CommissionPlanTierDto {
  @IsInt()
  @Min(1)
  tierOrder!: number;

  @IsNumber()
  @Min(0)
  minAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @IsNumber()
  rate?: number;

  @IsOptional()
  @IsNumber()
  fixedAmount?: number;
}

/**
 * Agent & Commission Management, RE-COMM.1 — Commission Plans.
 *
 * `entityId` is treated as immutable identity (same convention as
 * Agent.entityId / CreateAgentDto.entityId), enforced via RlsBodyCheck
 * on the controller.
 *
 * Exactly one of projectId/estateId/unitId/agentId must be supplied,
 * and it must match `scope` — GLOBAL supplies none. Validated by
 * CommissionPlanService.validateScopeTarget(), not here, since it's a
 * cross-field rule class-validator's per-property decorators can't
 * express cleanly (matching UpdateAgentDto's own precedent of pushing
 * cross-field rules into the service).
 *
 * Exactly one of (rate | fixedAmount) is required when isTiered is
 * false, matching `type`; when isTiered is true both are omitted and
 * `tiers` is required instead. Also service-validated, not here.
 */
export class CreateCommissionPlanDto {
  @IsString()
  entityId!: string;

  /** Caller-supplied, must be unique — same convention as Agent.code. */
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsEnum(CommissionPlanType)
  type!: CommissionPlanType;

  @IsEnum(CommissionPlanScope)
  scope!: CommissionPlanScope;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  estateId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsNumber()
  rate?: number;

  @IsOptional()
  @IsNumber()
  fixedAmount?: number;

  @IsOptional()
  @IsBoolean()
  isReferral?: boolean;

  @IsOptional()
  @IsBoolean()
  isTiered?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionPlanTierDto)
  tiers?: CommissionPlanTierDto[];

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Deliberately excludes `status`, `code`, `entityId`, `scope`, and the
 * scope-target columns (projectId/estateId/unitId/agentId) — changing
 * what a plan applies to after creation is a new-plan decision, not an
 * edit, same "identity is immutable" discipline UpdateAgentDto applies
 * to Agent.code/entityId. `status` moves only through
 * CommissionPlanService.deactivate() — see CommissionPlanStatus's own
 * schema doc comment for why there is no reactivation path.
 */
export class UpdateCommissionPlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  rate?: number;

  @IsOptional()
  @IsNumber()
  fixedAmount?: number;

  @IsOptional()
  @IsBoolean()
  isReferral?: boolean;

  @IsOptional()
  @IsBoolean()
  isTiered?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CommissionPlanTierDto)
  tiers?: CommissionPlanTierDto[];

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class DeactivateCommissionPlanDto {
  @IsString()
  reason!: string;
}
