import { Module } from '@nestjs/common';
import { RevenueRecognitionService } from './revenue-recognition.service';
import { RevenueRecognitionController } from './revenue-recognition.controller';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';

@Module({
  imports: [GeneralLedgerModule],
  controllers: [RevenueRecognitionController],
  providers: [RevenueRecognitionService],
  exports: [RevenueRecognitionService],
})
export class RevenueRecognitionModule {}
