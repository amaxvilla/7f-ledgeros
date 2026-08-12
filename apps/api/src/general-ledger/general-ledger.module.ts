import { Module } from '@nestjs/common';
import { PostingEngineService } from './posting-engine.service';
import { GeneralLedgerQueryService } from './general-ledger-query.service';
import { GeneralLedgerController } from './general-ledger.controller';

@Module({
  controllers: [GeneralLedgerController],
  providers: [PostingEngineService, GeneralLedgerQueryService],
  exports: [PostingEngineService, GeneralLedgerQueryService],
})
export class GeneralLedgerModule {}
