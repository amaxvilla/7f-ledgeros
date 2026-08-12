import { Module } from '@nestjs/common';
import { StorageController } from './storage.controller';
import { STORAGE_PROVIDER } from './storage.interface';
import { LocalDiskStorageProvider } from './providers/local-disk-storage.provider';
import { AwsS3StorageProvider } from './providers/aws-s3-storage.provider';
import { AwsS3HealthCheckDriver } from './providers/aws-s3-health-check.driver';
import { GoogleDriveStorageProvider } from './providers/google-drive-storage.provider';
import { GoogleDriveHealthCheckDriver } from './providers/google-drive-health-check.driver';
import { INTEGRATION_DRIVER_REGISTRY } from '../integrations/integration-provider-driver.interface';
import { IntegrationsModule } from '../integrations/integrations.module';

// Release IB — the first real driver registered into Release IA's
// (previously empty) INTEGRATION_DRIVER_REGISTRY. A module-load-time
// registration rather than something IntegrationsService reaches into
// StorageModule for, so the dependency direction stays one-way
// (Storage depends on Integrations, not the reverse).
INTEGRATION_DRIVER_REGISTRY['AWS_S3'] = new AwsS3HealthCheckDriver();
// Release IH (Google Workspace), Checkpoint C — GOOGLE_DRIVE has its own
// dedicated IntegrationProvider row (unlike Calendar, which reuses
// Gmail's — see GoogleDriveHealthCheckDriver's own doc comment) and had
// no health-check coverage until now.
INTEGRATION_DRIVER_REGISTRY['GOOGLE_DRIVE'] = new GoogleDriveHealthCheckDriver();

@Module({
  imports: [IntegrationsModule],
  controllers: [StorageController],
  providers: [
    LocalDiskStorageProvider,
    AwsS3StorageProvider,
    GoogleDriveStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      // Release IH (Google Workspace), Checkpoint B fills in the 'drive'
      // case this switch has named since Release IB — see
      // GoogleDriveStorageProvider's own doc comment for why it's a
      // genuinely different API/product from the `gcs` example this
      // switch also still names (Drive's file/folder + sharing-link
      // model, not S3-shaped object storage), and for the security
      // tradeoff its getUrl() makes that AWS_S3's presigned-URL path
      // does not.
      useFactory: (local: LocalDiskStorageProvider, s3: AwsS3StorageProvider, drive: GoogleDriveStorageProvider) => {
        const driver = process.env.STORAGE_DRIVER ?? 'local';
        switch (driver) {
          case 'local':
            return local;
          case 's3':
            return s3;
          case 'drive':
            return drive;
          // case 'gcs': return new GcsStorageProvider(...);
          default:
            throw new Error(
              `Unknown STORAGE_DRIVER "${driver}". Add a provider implementing StorageProvider and register it here.`,
            );
        }
      },
      inject: [LocalDiskStorageProvider, AwsS3StorageProvider, GoogleDriveStorageProvider],
    },
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
