import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { StorageProvider, UploadResult } from '../storage.interface';

@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly rootDir = process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), 'storage');
  // Base path the storage controller serves files back under. Matches
  // the global API prefix convention (/api/v1) used everywhere else.
  private readonly publicBasePath = '/api/v1/storage/files';

  async upload(params: { key: string; buffer: Buffer; contentType: string }): Promise<UploadResult> {
    const filePath = this.resolveSafePath(params.key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, params.buffer);
    return { key: params.key, url: `${this.publicBasePath}/${params.key}` };
  }

  async getUrl(key: string): Promise<string> {
    return `${this.publicBasePath}/${key}`;
  }

  async delete(key: string): Promise<void> {
    const filePath = this.resolveSafePath(key);
    await fs.rm(filePath, { force: true });
  }

  /** Resolves a key to an absolute path, rejecting any attempt to escape rootDir. */
  private resolveSafePath(key: string): string {
    const resolved = path.resolve(this.rootDir, key);
    if (!resolved.startsWith(path.resolve(this.rootDir))) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }
}
