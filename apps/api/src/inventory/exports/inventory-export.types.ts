export type InventoryExportType =
  | 'BALANCES'
  | 'MOVEMENTS'
  | 'RECEIPTS'
  | 'ISSUES'
  | 'TRANSFERS'
  | 'COUNTS';

export interface InventoryExportRequest {
  entityId: string;
  fromDate?: string;
  toDate?: string;
  warehouseId?: string;
  stockItemId?: string;
  type: InventoryExportType;
}

export interface InventoryExportResult {
  filename: string;
  contentType: 'text/csv';
  rowCount: number;
  csv: string;
}