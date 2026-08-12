import { Module } from '@nestjs/common';
import { LandBankService } from './land-bank.service';
import { LandBankController } from './land-bank.controller';

@Module({
  controllers: [LandBankController],
  providers: [LandBankService],
  exports: [LandBankService],
})
export class LandBankModule {}
