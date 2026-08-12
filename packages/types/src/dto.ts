import { AccountType, JournalEntryStatus, JournalSourceType } from './enums';

export interface EntitySummary {
  id: string;
  code: string;
  name: string;
  baseCurrency: string;
  isActive: boolean;
}

export interface AccountSummary {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  isPostable: boolean;
}

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  memo?: string;
  projectId?: string;
  phaseId?: string;
  blockId?: string;
  floorId?: string;
  unitId?: string;
  departmentId?: string;
  costCenterId?: string;
  fundingSourceId?: string;
  vendorId?: string;
  customerId?: string;
}

export interface JournalEntryInput {
  entityId: string;
  entryDate: string;
  description: string;
  sourceType?: JournalSourceType;
  sourceReference?: string;
  lines: JournalLineInput[];
}

export interface JournalEntrySummary {
  id: string;
  journalNumber: string;
  entityId: string;
  entryDate: string;
  description: string;
  status: JournalEntryStatus;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  debit: number;
  credit: number;
}

export interface TrialBalanceResult {
  entityId: string;
  fiscalPeriodId: string | null;
  rows: TrialBalanceRow[];
  totals: { debit: number; credit: number };
}
