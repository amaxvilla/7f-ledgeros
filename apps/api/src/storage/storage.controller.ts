import { Controller, Get, Inject, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { promises as fs } from 'fs';
import * as path from 'path';
import { STORAGE_PROVIDER } from './storage.interface';
import { LocalDiskStorageProvider } from './providers/local-disk-storage.provider';

@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(@Inject(STORAGE_PROVIDER) private readonly storage: LocalDiskStorageProvider) {}

  // Wildcard so nested keys (e.g. "entityId/logo/file.png") work.
  // Nest's Express adapter exposes the wildcard segment as params[0],
  // not a named param, for a plain '*' route token.
  @Get('files/*')
  @ApiOperation({
    summary: 'Serve a stored file by key (local-disk storage provider only)',
    description:
      'Returns 404 for any deployment not using the local-disk provider -- a real object-storage provider would never route file serving through this API at all. Resolves the requested path against the storage root and rejects anything that would resolve outside it (path-traversal guard).',
  })
  async getFile(@Param() params: Record<string, string>, @Res() res: Response) {
    const key = params['0'];
    // Only meaningful for the local provider; a real object-storage
    // provider wouldn't route through this controller at all.
    if (!(this.storage instanceof LocalDiskStorageProvider)) {
      throw new NotFoundException('This deployment does not serve files through the API');
    }
    const rootDir = process.env.STORAGE_LOCAL_PATH ?? path.join(process.cwd(), 'storage');
    const filePath = path.resolve(rootDir, key);
    if (!filePath.startsWith(path.resolve(rootDir))) {
      throw new NotFoundException('File not found');
    }
    try {
      const buffer = await fs.readFile(filePath);
      res.send(buffer);
    } catch {
      throw new NotFoundException('File not found');
    }
  }
}
