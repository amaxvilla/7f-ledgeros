import { Module } from '@nestjs/common';
import { AdminBrandingService } from './admin-branding.service';
import { AdminBrandingController } from './admin-branding.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AdminBrandingController],
  providers: [AdminBrandingService],
  exports: [AdminBrandingService],
})
export class AdminBrandingModule {}
