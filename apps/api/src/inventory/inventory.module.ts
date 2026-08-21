import { Module } from '@nestjs/common';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';
import { InventoryAccountingService } from './accounting/inventory-accounting.service';
import { InventoryExportService } from './exports/inventory-export.service';
import { InventoryImportService } from './imports/inventory-import.service';
import { InventoryReconciliationService } from './reconciliation/inventory-reconciliation.service';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [GeneralLedgerModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryAccountingService,
    InventoryImportService,
    InventoryExportService,
    InventoryReconciliationService,
  ],
  exports: [
    InventoryService,
    InventoryAccountingService,
    InventoryImportService,
    InventoryExportService,
    InventoryReconciliationService,
  ],
})
export class InventoryModule {}