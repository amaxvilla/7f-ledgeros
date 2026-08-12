import { IsIn, IsInt, IsOptional, IsString, IsNumber } from 'class-validator';

export class TriggerBankStatementImportDto {
  @IsString() entityId!: string;
  @IsString() bankAccountId!: string;
  @IsString() statementDate!: string;
  @IsString() periodStart!: string;
  @IsString() periodEnd!: string;
  @IsNumber() openingBalance!: number;
  @IsNumber() closingBalance!: number;
  @IsString() fileUrl!: string;
}

export class TriggerBudgetRecalculationDto {
  @IsOptional() @IsString() budgetId?: string;
  @IsOptional() @IsString() entityId?: string;
}

export class TriggerDashboardRefreshDto {
  @IsOptional() @IsString() entityId?: string;
}

export class TriggerReportGenerationDto {
  @IsIn([
    'budget-vs-actual',
    'project-profitability',
    'vendor-aging',
    'customer-aging',
    'cash-forecast',
    'bank-reconciliation-summary',
    'consolidated-trial-balance',
  ])
  reportKey!:
    | 'budget-vs-actual'
    | 'project-profitability'
    | 'vendor-aging'
    | 'customer-aging'
    | 'cash-forecast'
    | 'bank-reconciliation-summary'
    | 'consolidated-trial-balance';

  @IsString() entityId!: string;
  @IsOptional() @IsInt() fiscalYear?: number;
  @IsIn(['json', 'csv']) format!: 'json' | 'csv';
}
