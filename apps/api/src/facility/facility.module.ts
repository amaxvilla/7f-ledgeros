import { Module } from '@nestjs/common';
import { FacilityService } from './facility.service';
import { FacilityController } from './facility.controller';
import { WorkflowModule } from '../workflow/workflow.module';
import { AccountsPayableModule } from '../accounts-payable/accounts-payable.module';

@Module({
  imports: [WorkflowModule, AccountsPayableModule],
  controllers: [FacilityController],
  providers: [FacilityService],
  exports: [FacilityService],
})
export class FacilityModule {}
