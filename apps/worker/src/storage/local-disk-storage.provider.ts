import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Mirrors apps/api/src/storage/storage.interface.ts + local-disk-storage.provider.ts
 * exactly (same STORAGE_LOCAL_PATH env var, same key-resolution rules), so
 * files the worker writes (generated reports) are retrievable through the
 * API's existing `/api/v1/storage/files/:key` route without any change to
 * that route. Kept as a small local copy rather than a cross-package import
 * for the same reason as PrismaService — apps/api and apps/worker are
 * separate deployable processes.
 */
export interface UploadResult {
  key: string;
  url: string;
}

@Injectable()
export class LocalDiskStorageProvider {
  private readonly rootDir = process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), 'storage');
  private readonly publicBasePath = '/api/v1/storage/files';

  async upload(params: { key: string; buffer: Buffer; contentType: string }): Promise<UploadResult> {
    const filePath = this.resolveSafePath(params.key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, params.buffer);
    return { key: params.key, url: `${this.publicBasePath}/${params.key}` };
  }

  private resolveSafePath(key: string): string {
    const resolved = path.resolve(this.rootDir, key);
    if (!resolved.startsWith(path.resolve(this.rootDir))) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }
}
