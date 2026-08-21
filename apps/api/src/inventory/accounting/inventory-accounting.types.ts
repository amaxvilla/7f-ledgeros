export type InventoryAccountingEvent =
  | 'RECEIPT'
  | 'ISSUE'
  | 'TRANSFER'
  | 'COUNT_VARIANCE'
  | 'ADJUSTMENT'
  | 'VENDOR_INVOICE_CLEAR_GRNI';

export type InventoryAccountRole =
  | 'INVENTORY_ASSET'
  | 'GRNI'
  | 'COGS'
  | 'INVENTORY_GAIN'
  | 'INVENTORY_LOSS';

export interface InventoryPostingContext {
  entityId: string;
  sourceType: string;
  sourceId: string;
  postingDate: string;
  currency: string;
  reference?: string;
  description?: string;
}

export interface InventoryPostingResult {
  journalEntryId: string;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

export interface InventoryAccountConfiguration {
  entityId: string;
  inventoryAssetAccountId: string;
  grniAccountId: string;
  cogsAccountId: string;
  inventoryGainAccountId: string;
  inventoryLossAccountId: string;
  isActive: boolean;
}