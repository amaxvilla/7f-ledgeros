import { decryptIntegrationCredentials, encryptIntegrationCredentials, getIntegrationEncryptionKey } from './encryption';

describe('getIntegrationEncryptionKey', () => {
  const originalEnv = process.env.INTEGRATION_ENCRYPTION_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = originalEnv;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns a 32-byte key derived from the env var when set', () => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'some-secret-value';
    const key = getIntegrationEncryptionKey();
    expect(key).toHaveLength(32);
  });

  it('falls back to a dev-only key outside production when unset', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'test';
    expect(() => getIntegrationEncryptionKey()).not.toThrow();
  });

  it('throws in production when unset', () => {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    process.env.NODE_ENV = 'production';
    expect(() => getIntegrationEncryptionKey()).toThrow(/INTEGRATION_ENCRYPTION_KEY/);
  });
});

describe('encryptIntegrationCredentials / decryptIntegrationCredentials (Release IC.1)', () => {
  const originalEnv = process.env.INTEGRATION_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = 'test-key-for-encryption-spec';
  });

  afterAll(() => {
    process.env.INTEGRATION_ENCRYPTION_KEY = originalEnv;
  });

  it('round-trips an arbitrary credential object', () => {
    const secret = { user: 'apikey', password: 'sk_live_abc123' };
    const blob = encryptIntegrationCredentials(secret);
    expect(decryptIntegrationCredentials(blob)).toEqual(secret);
  });

  it('produces a different ciphertext each time (random IV) even for the same input', () => {
    const secret = { apiKey: 'same-value' };
    expect(encryptIntegrationCredentials(secret)).not.toBe(encryptIntegrationCredentials(secret));
  });

  it('throws on a tampered ciphertext (GCM auth tag mismatch)', () => {
    const blob = encryptIntegrationCredentials({ apiKey: 'sk_live_abc123' });
    const [iv, authTag, ciphertext] = blob.split(':');
    const tampered = `${iv}:${authTag}:${ciphertext.slice(0, -2)}00`;
    expect(() => decryptIntegrationCredentials(tampered)).toThrow();
  });

  it('throws on a malformed blob', () => {
    expect(() => decryptIntegrationCredentials('not-a-valid-blob')).toThrow('Malformed encrypted integration credential blob');
  });
});
