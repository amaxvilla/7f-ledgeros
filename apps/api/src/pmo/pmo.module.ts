import { Module } from '@nestjs/common';
import { PmoService } from './pmo.service';
import { PmoController } from './pmo.controller';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { RiskIssueService } from './risk-issue.service';
import { RiskController, IssueController } from './risk-issue.controller';
import { ResourceService } from './resource.service';
import { ResourceController, ResourceAllocationController } from './resource.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [PmoController, SchedulingController, RiskController, IssueController, ResourceController, ResourceAllocationController],
  providers: [PmoService, SchedulingService, RiskIssueService, ResourceService],
  exports: [PmoService, SchedulingService, RiskIssueService, ResourceService],
})
export class PmoModule {}
