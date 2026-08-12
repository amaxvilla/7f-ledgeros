import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';

/**
 * Release IB — Cloud Storage (AWS S3).
 *
 * The first real driver registered into Release IA's
 * INTEGRATION_DRIVER_REGISTRY (previously empty). Confirms the bucket is
 * reachable with the stored credentials via a lightweight HeadBucket call
 * — cheaper than a real upload/delete round trip and doesn't touch
 * bucket contents.
 */
export class AwsS3HealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const bucket = params.config?.bucket as string | undefined;
    const region = params.config?.region as string | undefined;
    const accessKeyId = params.credentials?.accessKeyId as string | undefined;
    const secretAccessKey = params.credentials?.secretAccessKey as string | undefined;

    if (!bucket || !region) {
      return { ok: false, message: 'Missing config.bucket or config.region' };
    }
    if (!accessKeyId || !secretAccessKey) {
      return { ok: false, message: 'Missing credentials.accessKeyId or credentials.secretAccessKey' };
    }

    const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      return { ok: true, message: `Bucket "${bucket}" is reachable` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    } finally {
      client.destroy();
    }
  }
}
