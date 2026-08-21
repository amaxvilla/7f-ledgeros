export interface InventoryReconciliationRequest {
  entityId: string;
  asOfDate: string;
  warehouseId?: string;
  stockItemId?: string;
}

export interface InventoryReconciliationDifference {
  accountId?: string;
  stockItemId?: string;
  warehouseId?: string;
  subledgerAmount: number;
  glAmount: number;
  variance: number;
  reason?: string;
}

export interface InventoryReconciliationResult {
  entityId: string;
  asOfDate: string;
  subledgerValue: number;
  glControlValue: number;
  variance: number;
  reconciled: boolean;
  differences: InventoryReconciliationDifference[];
}