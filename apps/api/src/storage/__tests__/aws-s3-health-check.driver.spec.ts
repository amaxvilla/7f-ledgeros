import { AwsS3HealthCheckDriver } from '../providers/aws-s3-health-check.driver';

const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock, destroy: jest.fn() })),
  };
});

describe('AwsS3HealthCheckDriver', () => {
  let driver: AwsS3HealthCheckDriver;

  beforeEach(() => {
    sendMock.mockReset();
    driver = new AwsS3HealthCheckDriver();
  });

  it('reports failure when config is incomplete', async () => {
    const result = await driver.healthCheck({ config: {}, credentials: { accessKeyId: 'a', secretAccessKey: 'b' } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('config.bucket');
  });

  it('reports failure when credentials are missing', async () => {
    const result = await driver.healthCheck({ config: { bucket: 'b', region: 'r' }, credentials: null });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('credentials');
  });

  it('reports ok when HeadBucket succeeds', async () => {
    sendMock.mockResolvedValue({});
    const result = await driver.healthCheck({
      config: { bucket: 'my-bucket', region: 'us-east-1' },
      credentials: { accessKeyId: 'a', secretAccessKey: 'c' },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('my-bucket');
  });

  it('reports failure when HeadBucket throws', async () => {
    sendMock.mockRejectedValue(new Error('Access Denied'));
    const result = await driver.healthCheck({
      config: { bucket: 'my-bucket', region: 'us-east-1' },
      credentials: { accessKeyId: 'a', secretAccessKey: 'c' },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Access Denied');
  });
});
