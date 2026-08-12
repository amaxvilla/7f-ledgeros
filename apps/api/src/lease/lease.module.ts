import { Module } from '@nestjs/common';
import { LeaseService } from './lease.service';
import { TenantController, LeaseController } from './lease.controller';
import { AccountsReceivableModule } from '../accounts-receivable/accounts-receivable.module';

@Module({
  imports: [AccountsReceivableModule],
  controllers: [TenantController, LeaseController],
  providers: [LeaseService],
  exports: [LeaseService],
})
export class LeaseModule {}
