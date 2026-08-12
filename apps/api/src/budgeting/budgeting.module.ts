import { Module } from '@nestjs/common';
import { BudgetingService } from './budgeting.service';
import { BudgetingController } from './budgeting.controller';

@Module({
  controllers: [BudgetingController],
  providers: [BudgetingService],
  exports: [BudgetingService],
})
export class BudgetingModule {}
