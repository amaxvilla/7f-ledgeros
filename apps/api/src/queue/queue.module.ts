import { Module } from '@nestjs/common';
import { QueueProducerService } from './queue-producer.service';
import { JobsController } from './jobs.controller';
import { JobRunsController } from './job-runs.controller';

@Module({
  controllers: [JobsController, JobRunsController],
  providers: [QueueProducerService],
  exports: [QueueProducerService],
})
export class QueueModule {}
