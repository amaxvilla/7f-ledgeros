import { AwsS3StorageProvider } from '../providers/aws-s3-storage.provider';

const sendMock = jest.fn();

jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation(() => ({ send: sendMock, destroy: jest.fn() })),
  };
});

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://signed.example.com/key'),
}));

describe('AwsS3StorageProvider', () => {
  let integrations: any;
  let provider: AwsS3StorageProvider;

  beforeEach(() => {
    sendMock.mockReset();
    integrations = {
      getProvider: jest.fn().mockResolvedValue({ config: { bucket: 'my-bucket', region: 'us-east-1' } }),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' }),
    };
    provider = new AwsS3StorageProvider(integrations);
    process.env.STORAGE_S3_PROVIDER_ID = 'provider-1';
  });

  afterEach(() => {
    delete process.env.STORAGE_S3_PROVIDER_ID;
  });

  it('throws when STORAGE_S3_PROVIDER_ID is not set', async () => {
    delete process.env.STORAGE_S3_PROVIDER_ID;
    await expect(
      provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' }),
    ).rejects.toThrow('STORAGE_S3_PROVIDER_ID');
  });

  it('throws when config is missing bucket/region', async () => {
    integrations.getProvider.mockResolvedValue({ config: {} });
    await expect(
      provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' }),
    ).rejects.toThrow('config.bucket or config.region');
  });

  it('throws when credentials are missing', async () => {
    integrations.getDecryptedCredentials.mockResolvedValue(null);
    await expect(
      provider.upload({ key: 'k', buffer: Buffer.from('x'), contentType: 'text/plain' }),
    ).rejects.toThrow('credentials.accessKeyId');
  });

  it('uploads a file and returns a signed URL', async () => {
    sendMock.mockResolvedValue({});
    const result = await provider.upload({ key: 'branding/logo.png', buffer: Buffer.from('hi'), contentType: 'image/png' });
    expect(sendMock).toHaveBeenCalled();
    expect(result.key).toBe('branding/logo.png');
    expect(result.url).toBe('https://signed.example.com/key');
  });

  it('deletes a file', async () => {
    sendMock.mockResolvedValue({});
    await provider.delete('branding/logo.png');
    expect(sendMock).toHaveBeenCalled();
  });

  it('resolves the integration provider config only once across multiple calls', async () => {
    sendMock.mockResolvedValue({});
    await provider.upload({ key: 'a', buffer: Buffer.from('1'), contentType: 'text/plain' });
    await provider.delete('a');
    await provider.getUrl('a');
    expect(integrations.getProvider).toHaveBeenCalledTimes(1);
    expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
  });
});
