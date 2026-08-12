import { Module } from '@nestjs/common';
import { HseService } from './hse.service';
import { HseController } from './hse.controller';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  controllers: [HseController],
  providers: [HseService],
  exports: [HseService],
})
export class HseModule {}
