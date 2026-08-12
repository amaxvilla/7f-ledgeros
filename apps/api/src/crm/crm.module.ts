import { Module } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';
import { DimensionsModule } from '../dimensions/dimensions.module';
import { RealEstateModule } from '../real-estate/real-estate.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DimensionsModule, RealEstateModule, NotificationsModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
