import { Module } from '@nestjs/common';
import { TaxService } from './tax.service';
import { TaxController } from './tax.controller';
import { AccountsPayableModule } from '../accounts-payable/accounts-payable.module';

@Module({
  imports: [AccountsPayableModule],
  controllers: [TaxController],
  providers: [TaxService],
  exports: [TaxService],
})
export class TaxModule {}
