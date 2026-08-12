import { Module } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { ProcurementController } from './procurement.controller';
import { BudgetingModule } from '../budgeting/budgeting.module';
import { InventoryModule } from '../inventory/inventory.module';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';

@Module({
  imports: [BudgetingModule, InventoryModule, GeneralLedgerModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
