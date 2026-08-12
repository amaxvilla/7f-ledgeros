import { Module } from '@nestjs/common';
import { WorkflowEngineService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [WorkflowController],
  providers: [WorkflowEngineService],
  exports: [WorkflowEngineService],
})
export class WorkflowModule {}
