import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationEncryptionService } from './integration-encryption.service';

@Module({
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationEncryptionService],
  exports: [IntegrationsService, IntegrationEncryptionService],
})
export class IntegrationsModule {}
