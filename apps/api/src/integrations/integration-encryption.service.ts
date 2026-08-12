import { Injectable } from '@nestjs/common';
import { decryptIntegrationCredentials, encryptIntegrationCredentials } from '@7f/config';

/**
 * Release IA — Core Integration Framework.
 *
 * Encrypts/decrypts the credential JSON blob (API keys, OAuth client
 * secrets, webhook signing secrets, ...) stored on
 * IntegrationProvider.encryptedCredentials.
 *
 * Release IC.1 moved the actual AES-256-GCM logic to
 * @7f/config's encryption.ts (so apps/worker can decrypt an
 * IntegrationProvider row directly too — see that file's doc comment).
 * This class is now a thin, still-injectable wrapper so every existing
 * caller/mock in apps/api is unaffected.
 *
 * IntegrationsService is the only caller within apps/api; the decrypted
 * value is never returned from a controller — see
 * IntegrationsService.getDecryptedCredentials's doc comment for why that
 * method is deliberately not wired to any HTTP route.
 */
@Injectable()
export class IntegrationEncryptionService {
  encrypt(plaintext: Record<string, unknown>): string {
    return encryptIntegrationCredentials(plaintext);
  }

  decrypt(stored: string): Record<string, unknown> {
    return decryptIntegrationCredentials(stored);
  }
}
