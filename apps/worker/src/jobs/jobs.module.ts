import { Module } from '@nestjs/common';
import { JobRunLogService } from './job-run-log.service';

@Module({
  providers: [JobRunLogService],
  exports: [JobRunLogService],
})
export class JobsModule {}
