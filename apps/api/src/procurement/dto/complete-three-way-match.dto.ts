import { IsOptional, IsString } from 'class-validator';

export class CompleteThreeWayMatchDto {
  // GL control account the vendor liability (AP voucher) is credited to.
  // Not hardcoded — the caller supplies the entity's actual AP control
  // account, following the same pattern used elsewhere (e.g. Revenue
  // Recognition's bankAccountGlId / deferredRevenueGlId).
  @IsString()
  apControlAccountId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
