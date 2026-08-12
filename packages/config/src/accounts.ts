/** Group-chart account codes referenced by seed data and module defaults. */
export const STANDARD_ACCOUNT_CODES = {
  CASH_AND_BANK: '1000',
  ACCOUNTS_RECEIVABLE: '1100',
  DUE_FROM_RELATED_PARTIES: '1150',
  PROPERTY_INVENTORY: '1300',
  ACCOUNTS_PAYABLE: '2000',
  GOODS_RECEIVED_NOT_INVOICED: '2050',
  WHT_PAYABLE: '2100',
  DUE_TO_RELATED_PARTIES: '2150',
  DEFERRED_REVENUE: '2200',
  SHARE_CAPITAL: '3000',
  RETAINED_EARNINGS: '3100',
  // Phase 3B — Statement of Changes in Equity needs these as distinct
  // line items (IAS 1), but the schema's AccountCategory enum has no
  // finer tag than OTHER_EQUITY/RETAINED_EARNINGS for any of them.
  // Deliberately NOT adding new enum values for this — see
  // ReportingService.buildChangesInEquity's doc comment: they're
  // recovered via the same ifrs_mapping/account_name heuristic already
  // used throughout Phase 3A (vw_financial_ratios, Cash Flow statement),
  // which is why each of these carries a distinguishing ifrsMapping/name
  // below rather than a new category.
  SHARE_PREMIUM: '3050',
  REVALUATION_RESERVE: '3200',
  FOREIGN_CURRENCY_TRANSLATION_RESERVE: '3300',
  OTHER_EQUITY_RESERVES: '3400',
  DIVIDENDS_DECLARED: '3500',
  PROPERTY_SALES_REVENUE: '4000',
  OTHER_REVENUE: '4900',
  COST_OF_SALES: '5000',
  OPERATING_EXPENSES: '6000',
  // Release (Fixed Assets Core, additive)
  FIXED_ASSETS: '1400',
  ACCUMULATED_DEPRECIATION: '1450',
  DEPRECIATION_EXPENSE: '6100',
} as const;

export const DEFAULT_BASE_CURRENCY = 'NGN';
export const DEFAULT_TIMEZONE = 'Africa/Lagos';
