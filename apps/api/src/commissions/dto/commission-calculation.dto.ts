import { IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CommissionBasisType, CommissionCollectionBasis } from '@prisma/client';

/**
 * Agent & Commission Management, RE-COMM.2 — Commission Calculation.
 *
 * `agentAssignmentId` must reference a SALE-scope AgentAssignment
 * (allocationId populated) — CommissionCalculationService re-resolves
 * the allocation/agent/entity from the assignment itself, never trusts
 * a caller-supplied allocationId/agentId/entityId directly, matching
 * AgentAssignmentService's own "resolve server-side" discipline.
 *
 * `basisType` picks gross vs. net sale value as the amount a plan's
 * rate/tier is applied against; `discountAmount` (default 0) is
 * subtracted from the sale's own salePrice to produce the net value —
 * required when basisType is NET, ignored (but still accepted, in case
 * a discount exists for record-keeping even on a GROSS calculation) when
 * basisType is GROSS.
 *
 * `collectionBasis` FULL (default) uses the full commission basis as-is;
 * COLLECTED prorates it to the percentage of the sale's own
 * InstallmentSchedule actually paid-to-date — rejected with a 400 if the
 * sale has no InstallmentSchedule (a cash sale has nothing to prorate
 * against).
 *
 * `whtTaxCodeId` is optional — omit for an Agent with
 * withholdingTaxExempt=true (validated: supplying one for an exempt
 * agent is rejected, not silently ignored) or for a jurisdiction with no
 * WHT on commissions.
 */
export class CalculateCommissionDto {
  @IsString()
  agentAssignmentId!: string;

  @IsEnum(CommissionBasisType)
  basisType!: CommissionBasisType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsEnum(CommissionCollectionBasis)
  collectionBasis?: CommissionCollectionBasis;

  @IsOptional()
  @IsString()
  whtTaxCodeId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReverseCommissionCalculationDto {
  @IsString()
  reason!: string;
}

export class CancelCommissionCalculationDto {
  @IsString()
  reason!: string;
}

/**
 * RE-COMM.3 — Commission Lifecycle. See CommissionCalculationStatus's
 * own schema doc comment for the full transition graph these map to.
 * `submit`/`approve`/`markPayable` take no body of their own beyond an
 * optional note — the row already carries everything else needed
 * (who/when is stamped by CommissionCalculationService, not supplied by
 * the caller).
 */
export class SubmitCommissionCalculationDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveCommissionCalculationDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectCommissionCalculationDto {
  @IsString()
  reason!: string;
}

/**
 * RE-COMM.4 — Financial Integration. Not hardcoded — caller supplies
 * the entity's actual commission expense/payable accounts, same
 * convention PostAPInvoiceDto's own apControlAccountId already
 * established. WHT (if applicable) posts to the calculation's own
 * already-stored whtAuthorityAccountId — not asked for again here.
 */
export class MarkPayableCommissionCalculationDto {
  @IsString()
  commissionExpenseAccountId!: string;

  @IsString()
  commissionPayableAccountId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * RE-COMM.4 — Financial Integration. `cashAccountId` is the only new
 * account the caller supplies here — the payable account being cleared
 * is reused from what markPayable itself already recorded, per
 * CommissionCalculation.payableAccountId's own schema doc comment (so
 * the two legs of the accrual/clearing pair can never mismatch).
 */
export class MarkPaidCommissionCalculationDto {
  @IsString()
  cashAccountId!: string;

  @IsString()
  paymentReference!: string;
}

/**
 * Reverses the target calculation and creates a brand-new one from
 * `recalculate` in a single transaction — see CommissionCalculation.
 * supersedesCalculationId's own schema doc comment for why this is not
 * an in-place edit. `reason` documents why the original was wrong (the
 * same field `reverse` itself already requires); `recalculate` is the
 * full `CalculateCommissionDto` for the corrected commission.
 */
export class AdjustCommissionCalculationDto {
  @IsString()
  reason!: string;

  @ValidateNested()
  @Type(() => CalculateCommissionDto)
  recalculate!: CalculateCommissionDto;
}
