import { Module } from '@nestjs/common';
import { ConsolidationService } from './consolidation.service';
import { ConsolidationController } from './consolidation.controller';

@Module({
  controllers: [ConsolidationController],
  providers: [ConsolidationService],
  exports: [ConsolidationService],
})
export class ConsolidationModule {}
