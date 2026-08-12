import { Injectable } from '@nestjs/common';
import { acquireGoogleAccessToken } from '@7f/config';
import { StorageProvider, UploadResult } from '../storage.interface';
import { IntegrationsService } from '../../integrations/integrations.service';

const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/drive/v3';
const MULTIPART_BOUNDARY = '7f-ledgeros-drive-upload-boundary';

interface ResolvedDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
}

/**
 * Release IH (Google Workspace), Checkpoint B — the second
 * StorageProvider besides LocalDiskStorageProvider/AwsS3StorageProvider,
 * filling in the `case 'gcs':`-shaped extension point storage.module.ts
 * has named since Release IB (see this file's own registration there).
 * "Drive" per the roadmap's actual Google Drive API (file/folder
 * semantics, shareable links), not Google Cloud Storage (S3-shaped
 * object storage) — a different product with a different API, despite
 * the commented-out `GcsStorageProvider` example in storage.module.ts
 * suggesting the latter; STORAGE_DRIVER=drive is this provider's own
 * key, not "gcs".
 *
 * CREDENTIAL ROW: deliberately does NOT reuse the GMAIL_EMAIL
 * IntegrationProvider row the way GoogleCalendarProvider
 * (calendar/providers/google-calendar.provider.ts, Release IH
 * Checkpoint A) reuses it for Calendar. That reuse made sense there
 * because Calendar's entire config (clientId/senderUserId-equivalent)
 * IS the same "which mailbox" concept Gmail already has. Storage's
 * config here — folderId, a Drive-specific "where do our files live"
 * setting — is NOT a mail concept, and AwsS3StorageProvider (this same
 * module's own sibling) already established the convention that a
 * storage provider gets its OWN dedicated IntegrationProvider row
 * (STORAGE_S3_PROVIDER_ID) rather than borrowing another domain's.
 * Followed that closer, same-module precedent instead:
 * STORAGE_DRIVE_PROVIDER_ID (env), category STORAGE, providerCode
 * "GOOGLE_DRIVE", config {folderId, clientId}, credentials
 * {clientSecret, refreshToken} — a SEPARATE OAuth consent from Gmail's,
 * granted the drive.file scope (not drive's full-access scope — see
 * KNOWN LIMITATION below for what that restricts).
 *
 * KEY -> FILE ID: Drive has no S3-style "key" a caller addresses a file
 * by; it assigns its own opaque file id at creation and only supports
 * search-by-metadata (name, parents) after that. This provider stores
 * our own `key` as the Drive file's `name` within the configured
 * `folderId`, and re-resolves `key` -> Drive file id via a `files.list`
 * search (`findFileId`) on every getUrl/delete/re-upload call — an
 * extra Drive API round-trip StorageProvider's interface contract
 * doesn't give a way to avoid without either changing UploadResult
 * (breaking every existing caller of StorageProvider, including
 * LocalDiskStorageProvider/AwsS3StorageProvider's identical shape) or
 * this provider maintaining its own id-cache Prisma table (a bigger
 * addition than this checkpoint's scope). Acceptable for the current
 * caller volume (branding assets); flagged rather than silently eaten,
 * same as AwsS3StorageProvider's own credential-rotation-latency note.
 *
 * KNOWN LIMITATION — PUBLIC LINK, NO EXPIRY: AwsS3StorageProvider's
 * getUrl returns a presigned URL that expires in 1 hour and requires no
 * change to the object's own ACL. Drive has no equivalent time-boxed
 * link mechanism — the only way to produce a URL usable by a caller
 * with no Google auth of their own is to grant the file a
 * `role: reader, type: anyone` permission (anyone with the link can
 * view) and return its `webContentLink`, which this provider does on
 * every upload. Unlike S3's presigned URL, this access does NOT expire
 * on its own — it persists until the file (or its permission) is
 * explicitly deleted. This is a materially different security posture
 * from every other StorageProvider implementation and is being flagged
 * here deliberately rather than presented as equivalent; anything
 * genuinely sensitive should not be routed through STORAGE_DRIVER=drive
 * until a later checkpoint addresses this (e.g. resolving a fresh,
 * short-lived link per getUrl() call via `alt=media` + a
 * server-proxied download instead of a public permission).
 *
 * Token acquisition reuses @7f/config's acquireGoogleAccessToken — same
 * helper GmailMailService/GoogleCalendarProvider already call.
 */
@Injectable()
export class GoogleDriveStorageProvider implements StorageProvider {
  private resolved: Promise<ResolvedDriveConfig> | null = null;

  constructor(private readonly integrations: IntegrationsService) {}

  async upload(params: { key: string; buffer: Buffer; contentType: string }): Promise<UploadResult> {
    const { token, folderId } = await this.getAuth();
    const existingFileId = await this.findFileId(params.key, token, folderId);

    const fileId = existingFileId
      ? await this.updateFileContent(existingFileId, params.buffer, params.contentType, token)
      : await this.createFile(params.key, params.buffer, params.contentType, token, folderId);

    await this.ensureSharedReadable(fileId, token);
    // Uses the fileId already in hand rather than calling this.getUrl(key)
    // (which would re-search by key and re-acquire a token it doesn't
    // need to) — same token+fileId this call already resolved.
    return { key: params.key, url: await this.getWebContentLink(fileId, token) };
  }

  async getUrl(key: string): Promise<string> {
    const { token, folderId } = await this.getAuth();
    const fileId = await this.findFileId(key, token, folderId);
    if (!fileId) {
      throw new Error(`No Drive file found for key "${key}" in folder ${folderId}`);
    }
    return this.getWebContentLink(fileId, token);
  }

  async delete(key: string): Promise<void> {
    const { token, folderId } = await this.getAuth();
    const fileId = await this.findFileId(key, token, folderId);
    if (!fileId) return; // already gone — same idempotent-delete stance as GoogleCalendarProvider.cancelEvent treating 410 as success

    const res = await fetch(`${DRIVE_API_BASE_URL}/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok && res.status !== 404) {
      const json = (await this.parseJson(res)) as { error?: { message?: string } };
      throw new Error(`Google Drive delete file failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  private async getWebContentLink(fileId: string, token: string): Promise<string> {
    const res = await fetch(`${DRIVE_API_BASE_URL}/files/${fileId}?fields=webContentLink`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await this.parseJson(res)) as { webContentLink?: string; error?: { message?: string } };
    if (!res.ok) {
      throw new Error(`Google Drive get file failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
    if (!json.webContentLink) {
      throw new Error(`Drive file ${fileId} has no webContentLink — ensureSharedReadable may not have run`);
    }
    return json.webContentLink;
  }

  private async findFileId(key: string, token: string, folderId: string): Promise<string | null> {
    const escapedKey = key.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const query = `name = '${escapedKey}' and '${folderId}' in parents and trashed = false`;
    const res = await fetch(`${DRIVE_API_BASE_URL}/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = (await this.parseJson(res)) as { files?: { id: string }[]; error?: { message?: string } };
    if (!res.ok) {
      throw new Error(`Google Drive search failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
    return json.files?.[0]?.id ?? null;
  }

  private async createFile(key: string, buffer: Buffer, contentType: string, token: string, folderId: string): Promise<string> {
    const metadata = { name: key, parents: [folderId] };
    const body = this.buildMultipartBody(metadata, buffer, contentType);

    const res = await fetch(`${DRIVE_UPLOAD_BASE_URL}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
      },
      body,
    });

    const json = (await this.parseJson(res)) as { id?: string; error?: { message?: string } };
    if (!res.ok || !json.id) {
      throw new Error(`Google Drive create file failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
    return json.id;
  }

  private async updateFileContent(fileId: string, buffer: Buffer, contentType: string, token: string): Promise<string> {
    const res = await fetch(`${DRIVE_UPLOAD_BASE_URL}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: buffer,
    });
    if (!res.ok) {
      const json = (await this.parseJson(res)) as { error?: { message?: string } };
      throw new Error(`Google Drive update file content failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
    return fileId;
  }

  /** See class doc comment's KNOWN LIMITATION — grants public
   *  read access with no expiry, the only way to produce a URL usable
   *  without the caller having Google auth of their own. */
  private async ensureSharedReadable(fileId: string, token: string): Promise<void> {
    const res = await fetch(`${DRIVE_API_BASE_URL}/files/${fileId}/permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
    if (!res.ok) {
      const json = (await this.parseJson(res)) as { error?: { message?: string } };
      throw new Error(`Google Drive set permission failed: HTTP ${res.status} — ${json.error?.message ?? 'unknown error'}`);
    }
  }

  private buildMultipartBody(metadata: Record<string, unknown>, buffer: Buffer, contentType: string): Buffer {
    const metadataPart = Buffer.from(
      `--${MULTIPART_BOUNDARY}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      'utf-8',
    );
    const mediaHeader = Buffer.from(`--${MULTIPART_BOUNDARY}\r\nContent-Type: ${contentType}\r\n\r\n`, 'utf-8');
    const closing = Buffer.from(`\r\n--${MULTIPART_BOUNDARY}--`, 'utf-8');
    return Buffer.concat([metadataPart, mediaHeader, buffer, closing]);
  }

  private async getAuth(): Promise<{ token: string; folderId: string }> {
    const config = await this.getConfig();
    const token = await acquireGoogleAccessToken(config.clientId, config.clientSecret, config.refreshToken);
    return { token, folderId: config.folderId };
  }

  private async getConfig(): Promise<ResolvedDriveConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedDriveConfig> {
    const providerId = process.env.STORAGE_DRIVE_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'STORAGE_DRIVE_PROVIDER_ID is not set. Create an IntegrationProvider (category STORAGE, providerCode "GOOGLE_DRIVE") with config {folderId, clientId} and credentials {clientSecret, refreshToken} (drive.file scope), then set STORAGE_DRIVE_PROVIDER_ID to its id.',
      );
    }

    const provider = await this.integrations.getProvider(providerId);
    if (provider.providerCode !== 'GOOGLE_DRIVE') {
      throw new Error(`Integration provider ${providerId} is providerCode "${provider.providerCode}", expected "GOOGLE_DRIVE"`);
    }
    if (!provider.isActive) {
      throw new Error(`Integration provider ${providerId} (GOOGLE_DRIVE) is not active`);
    }

    const config = (provider.config as Record<string, unknown> | null) ?? {};
    const folderId = config.folderId as string | undefined;
    const clientId = config.clientId as string | undefined;
    const missingConfig = [!folderId && 'folderId', !clientId && 'clientId'].filter(Boolean);
    if (missingConfig.length) {
      throw new Error(`Integration provider ${providerId} is missing config.${missingConfig.join(', config.')}`);
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const clientSecret = credentials?.clientSecret as string | undefined;
    const refreshToken = credentials?.refreshToken as string | undefined;
    const missingCredentials = [!clientSecret && 'clientSecret', !refreshToken && 'refreshToken'].filter(Boolean);
    if (missingCredentials.length) {
      throw new Error(`Integration provider ${providerId} is missing credentials.${missingCredentials.join(', credentials.')}`);
    }

    return { clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken!, folderId: folderId! };
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
