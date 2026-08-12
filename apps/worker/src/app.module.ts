import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';
import { SchedulerService } from './queues/scheduler.service';
import { ProcessorsModule } from './processors/processors.module';
import { HealthModule } from './health/health.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

@Module({
  imports: [
    PrismaModule,
    QueuesModule,
    ScheduleModule.forRoot(),
    ProcessorsModule,
    HealthModule,
    MonitoringModule,
    FeatureFlagsModule,
  ],
  providers: [SchedulerService],
})
export class AppModule {}
