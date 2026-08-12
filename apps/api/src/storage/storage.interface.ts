/**
 * Vendor-agnostic file storage abstraction. Every module that needs to
 * persist a file (branding assets today; Document Management and AI
 * document ingestion in later phases) depends on this interface, never
 * on a concrete provider — so swapping local disk for S3/Azure
 * Blob/GCS later is a one-file change (a new provider class + one line
 * in storage.module.ts), not a rewrite of every caller.
 */
export interface UploadResult {
  /** Opaque key the provider uses to address this file internally. */
  key: string;
  /** URL callers should use to retrieve the file. */
  url: string;
}

export interface StorageProvider {
  upload(params: { key: string; buffer: Buffer; contentType: string }): Promise<UploadResult>;
  getUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
}

/** DI token — inject with `@Inject(STORAGE_PROVIDER)`. */
export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
