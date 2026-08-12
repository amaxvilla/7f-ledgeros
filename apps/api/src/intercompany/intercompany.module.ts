import { Module } from '@nestjs/common';
import { IntercompanyService } from './intercompany.service';
import { IntercompanyController } from './intercompany.controller';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';

@Module({
  imports: [GeneralLedgerModule],
  controllers: [IntercompanyController],
  providers: [IntercompanyService],
  exports: [IntercompanyService],
})
export class IntercompanyModule {}
