import { Module } from '@nestjs/common';
import { AccountsPayableService } from './accounts-payable.service';
import { AccountsPayableController } from './accounts-payable.controller';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';

@Module({
  imports: [GeneralLedgerModule],
  controllers: [AccountsPayableController],
  providers: [AccountsPayableService],
  exports: [AccountsPayableService],
})
export class AccountsPayableModule {}
