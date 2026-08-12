import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LocalDiskStorageProvider } from '../providers/local-disk-storage.provider';

describe('LocalDiskStorageProvider', () => {
  let tmpDir: string;
  let provider: LocalDiskStorageProvider;
  let originalEnv: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ledgeros-storage-test-'));
    originalEnv = process.env.STORAGE_LOCAL_PATH;
    process.env.STORAGE_LOCAL_PATH = tmpDir;
    provider = new LocalDiskStorageProvider();
  });

  afterEach(async () => {
    process.env.STORAGE_LOCAL_PATH = originalEnv;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes and serves a file under its configured root', async () => {
    const result = await provider.upload({ key: 'branding/e1/logo.png', buffer: Buffer.from('hello'), contentType: 'image/png' });
    expect(result.key).toBe('branding/e1/logo.png');
    expect(result.url).toContain('branding/e1/logo.png');

    const written = await fs.readFile(path.join(tmpDir, 'branding/e1/logo.png'));
    expect(written.toString()).toBe('hello');
  });

  it('rejects a key that attempts to escape the storage root', async () => {
    await expect(
      provider.upload({ key: '../../etc/passwd', buffer: Buffer.from('x'), contentType: 'text/plain' }),
    ).rejects.toThrow('Invalid storage key');
  });

  it('deletes a previously uploaded file', async () => {
    await provider.upload({ key: 'temp.txt', buffer: Buffer.from('bye'), contentType: 'text/plain' });
    await provider.delete('temp.txt');
    await expect(fs.readFile(path.join(tmpDir, 'temp.txt'))).rejects.toThrow();
  });
});
