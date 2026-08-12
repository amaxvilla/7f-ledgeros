import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, UploadResult } from '../storage.interface';
import { IntegrationsService } from '../../integrations/integrations.service';

interface ResolvedS3Config {
  client: S3Client;
  bucket: string;
}

/**
 * Release IB — Cloud Storage (AWS S3).
 *
 * Implements the same StorageProvider interface LocalDiskStorageProvider
 * does (see storage.interface.ts) — every existing caller (branding
 * assets today) needs zero changes to work against S3 instead of disk.
 *
 * Deliberately does NOT take an access key / secret / bucket from its own
 * env vars — it resolves them from an IntegrationProvider row (category
 * STORAGE, providerCode "AWS_S3") via IntegrationsService, exactly the
 * extension point Release IA's driver interface doc comment describes.
 * STORAGE_S3_PROVIDER_ID (env) points at that row's id. This keeps
 * credential storage, encryption, and rotation entirely within the
 * Release IA framework rather than introducing a second, parallel way to
 * configure a secret.
 */
@Injectable()
export class AwsS3StorageProvider implements StorageProvider {
  private resolved: Promise<ResolvedS3Config> | null = null;

  constructor(private readonly integrations: IntegrationsService) {}

  async upload(params: { key: string; buffer: Buffer; contentType: string }): Promise<UploadResult> {
    const { client, bucket } = await this.getConfig();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );
    return { key: params.key, url: await this.getUrl(params.key) };
  }

  async getUrl(key: string): Promise<string> {
    const { client, bucket } = await this.getConfig();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    // 1 hour — matches the "opaque, not permanently public" contract
    // implied by StorageProvider.getUrl; callers needing a longer-lived
    // link should re-request it rather than this provider caching one.
    return getSignedUrl(client, command, { expiresIn: 3600 });
  }

  async delete(key: string): Promise<void> {
    const { client, bucket } = await this.getConfig();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  /**
   * Resolved once per process lifetime (not per call) — credential
   * rotation via IntegrationsService.rotateCredentials() takes effect on
   * the next deploy/restart, not live. Acceptable for this release; a
   * follow-up could add a short TTL if live rotation becomes a
   * requirement.
   */
  private async getConfig(): Promise<ResolvedS3Config> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedS3Config> {
    const providerId = process.env.STORAGE_S3_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'STORAGE_S3_PROVIDER_ID is not set. Create an IntegrationProvider (category STORAGE, providerCode "AWS_S3") with config {bucket, region} and credentials {accessKeyId, secretAccessKey}, then set STORAGE_S3_PROVIDER_ID to its id.',
      );
    }

    const [provider, credentials] = await Promise.all([
      this.integrations.getProvider(providerId),
      this.integrations.getDecryptedCredentials(providerId),
    ]);

    const config = (provider.config ?? {}) as { bucket?: string; region?: string };
    if (!config.bucket || !config.region) {
      throw new Error(`Integration provider ${providerId} is missing config.bucket or config.region`);
    }

    const accessKeyId = credentials?.accessKeyId as string | undefined;
    const secretAccessKey = credentials?.secretAccessKey as string | undefined;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(`Integration provider ${providerId} is missing credentials.accessKeyId or credentials.secretAccessKey`);
    }

    const client = new S3Client({
      region: config.region,
      credentials: { accessKeyId, secretAccessKey },
    });

    return { client, bucket: config.bucket };
  }
}
