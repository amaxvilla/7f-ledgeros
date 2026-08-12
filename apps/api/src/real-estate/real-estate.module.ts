import { Module } from '@nestjs/common';
import { RealEstateService } from './real-estate.service';
import { RealEstateController } from './real-estate.controller';
import { AccountsReceivableModule } from '../accounts-receivable/accounts-receivable.module';

@Module({
  imports: [AccountsReceivableModule],
  controllers: [RealEstateController],
  providers: [RealEstateService],
  exports: [RealEstateService],
})
export class RealEstateModule {}
