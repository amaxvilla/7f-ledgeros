export interface InventoryImportRow {
  rowNumber: number;
  entityId: string;
  warehouseCode: string;
  stockItemCode: string;
  quantity: number;
  unitCost: number;
  movementDate: string;
  reference?: string;
}

export interface InventoryImportError {
  rowNumber: number;
  field?: string;
  message: string;
}

export interface InventoryImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: InventoryImportError[];
  rows: InventoryImportRow[];
}

export interface InventoryImportResult {
  importId: string;
  status: 'PREVIEWED' | 'IMPORTED' | 'FAILED';
  totalRows: number;
  importedRows: number;
  failedRows: number;
  errors: InventoryImportError[];
}