import { Module } from '@nestjs/common';
import { HandoverService } from './handover.service';
import { HandoverController, SnagController } from './handover.controller';
import { RevenueRecognitionModule } from '../revenue-recognition/revenue-recognition.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [RevenueRecognitionModule, NotificationsModule],
  controllers: [HandoverController, SnagController],
  providers: [HandoverService],
  exports: [HandoverService],
})
export class HandoverModule {}
