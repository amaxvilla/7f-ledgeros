import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Release IA — Core Integration Framework.
 *
 * Resolves the key used to encrypt third-party integration credentials
 * (API keys, OAuth client secrets, etc.) at rest in IntegrationProvider
 * .encryptedCredentials. Mirrors getJwtAccessSecret's resolution rules
 * exactly (see jwt.ts) — missing key is fatal in production, a
 * clearly-labelled dev-only value is used otherwise — for the same
 * reason: a silent, publicly-known fallback in production would let
 * anyone decrypt every stored integration credential.
 *
 * The raw env value can be any length; it's hashed with SHA-256 to
 * always yield a 32-byte key, which is what AES-256-GCM requires.
 */
export function getIntegrationEncryptionKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (secret && secret.trim().length > 0) {
    return createHash('sha256').update(secret).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'INTEGRATION_ENCRYPTION_KEY is not set. Refusing to start in production without a key to encrypt stored integration credentials.',
    );
  }
  return createHash('sha256').update('dev-only-insecure-integration-encryption-key').digest();
}

const INTEGRATION_CREDENTIAL_ALGORITHM = 'aes-256-gcm';
const INTEGRATION_CREDENTIAL_IV_BYTES = 12; // 96-bit IV is the recommended size for GCM

/**
 * Release IC.1 — Email Integration (SMTP wiring). Extracted out of
 * apps/api's IntegrationEncryptionService so apps/worker can decrypt an
 * IntegrationProvider row's credentials too, without apps/worker ever
 * importing anything from apps/api/src (the two are separately deployed
 * processes — see InternalApiClient's doc comment on why they only ever
 * talk over HTTP) and without a second, drifting implementation of the
 * same AES-256-GCM scheme. IntegrationEncryptionService.encrypt/decrypt
 * now delegate to these two functions directly; nothing about its own
 * public shape changed.
 *
 * This does NOT reopen the "no HTTP route ever returns a decrypted
 * secret" invariant IntegrationsService.getDecryptedCredentials documents
 * — apps/worker decrypts locally, from its own direct DB read of
 * integration_providers, using the same INTEGRATION_ENCRYPTION_KEY both
 * processes already have as an env var. No decrypted value ever crosses
 * the network between the two apps.
 */
export function encryptIntegrationCredentials(plaintext: Record<string, unknown>): string {
  const key = getIntegrationEncryptionKey();
  const iv = randomBytes(INTEGRATION_CREDENTIAL_IV_BYTES);
  const cipher = createCipheriv(INTEGRATION_CREDENTIAL_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptIntegrationCredentials(stored: string): Record<string, unknown> {
  const [ivHex, authTagHex, ciphertextHex] = stored.split(':');
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error('Malformed encrypted integration credential blob');
  }
  const key = getIntegrationEncryptionKey();
  const decipher = createDecipheriv(INTEGRATION_CREDENTIAL_ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return JSON.parse(plaintext.toString('utf8'));
}
