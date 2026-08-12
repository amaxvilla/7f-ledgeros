import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';
import { acquireGoogleServiceAccountAccessToken } from '@7f/config';

/**
 * Release IH (Google Workspace), Checkpoint G.
 *
 * Decides and implements the `IntegrationProvider` credential/config
 * shape for a Google service-account JSON key — the gap Checkpoint F's
 * own report named as the next unblock after building the raw
 * `acquireGoogleServiceAccountAccessToken` primitive. No Prisma change
 * needed: `IntegrationProvider.config`/`.encryptedCredentials` are
 * already free-form JSON (see the model's own field comments), so this
 * checkpoint is the same kind of decision `GoogleDriveHealthCheckDriver`
 * made for `config.folderId` — a shape convention enforced by every
 * driver that reads it, not a schema migration:
 *
 *  - `config.impersonatedAdminEmail` — the Workspace super-admin (or any
 *    domain user with Directory API read access) this row impersonates
 *    via domain-wide delegation. Every Directory API call needs a `sub`;
 *    there is no "no impersonation" mode that makes sense for this
 *    category (see workspace-admin-provider.interface.ts's own note that
 *    a service account's un-impersonated identity isn't a Workspace user
 *    the Directory API will accept).
 *  - `credentials.clientEmail` / `credentials.privateKey` — the two
 *    fields of a downloaded service-account JSON key that
 *    `acquireGoogleServiceAccountAccessToken` needs (see
 *    google-service-account.ts). Deliberately just these two, not the
 *    whole downloaded JSON file verbatim (which also contains a
 *    project_id, private_key_id, client_id, etc. this codebase has no
 *    use for yet) — same "store only the fields a driver actually reads"
 *    discipline `credentials.clientSecret`/`.refreshToken` already
 *    follow for every OAuth-based provider here. `encryptIntegrationCredentials`
 *    stores this as ordinary JSON, so the private key's embedded
 *    newlines round-trip unchanged (JSON.stringify/parse already escape/
 *    unescape them) — no separate multi-line-safe encoding needed.
 *
 * Health-check posture matches GoogleDriveHealthCheckDriver's and
 * GmailEmailHealthCheckDriver's own precedent exactly: acquire a token,
 * then one cheap authenticated GET confirming a *specific* resource is
 * reachable — here, the impersonated admin's own Directory API user
 * record — rather than a broader, side-effecting call (no user is
 * created/suspended/listed just to check connectivity). Uses the
 * read-only `admin.directory.user.readonly` scope for the same reason:
 * a health check should not need write scopes.
 *
 * Registered as `GOOGLE_WORKSPACE_ADMIN` under the `GOOGLE_WORKSPACE`
 * IntegrationCategory (already in prisma/schema.prisma) — a fresh
 * providerCode, not reused from GOOGLE_DRIVE or any Calendar/Contacts
 * row, since a service-account key is a fundamentally different
 * credential shape than every other row in that category and mixing
 * them under one providerCode would make `config`/`credentials` mean two
 * different things for the same key. Still no concrete
 * `WorkspaceAdminProvider` bound to `WorkspaceAdminProviderRegistry` —
 * that remains the next checkpoint after this one, per Checkpoint E's
 * own scoping.
 */
export class GoogleWorkspaceAdminHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const impersonatedAdminEmail = params.config?.impersonatedAdminEmail as string | undefined;
    const clientEmail = params.credentials?.clientEmail as string | undefined;
    const privateKey = params.credentials?.privateKey as string | undefined;

    const missingConfig = [!impersonatedAdminEmail && 'impersonatedAdminEmail'].filter(Boolean);
    if (missingConfig.length) {
      return { ok: false, message: `Missing config.${missingConfig.join(', config.')}` };
    }
    const missingCredentials = [!clientEmail && 'clientEmail', !privateKey && 'privateKey'].filter(Boolean);
    if (missingCredentials.length) {
      return { ok: false, message: `Missing credentials.${missingCredentials.join(', credentials.')}` };
    }

    let accessToken: string;
    try {
      accessToken = await acquireGoogleServiceAccountAccessToken(
        { clientEmail: clientEmail!, privateKey: privateKey! },
        {
          scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
          impersonatedUserEmail: impersonatedAdminEmail,
        },
      );
    } catch (err) {
      return { ok: false, message: `Token acquisition failed: ${(err as Error).message}` };
    }

    try {
      const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(impersonatedAdminEmail!)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        return { ok: false, message: `Directory API rejected the impersonated-admin lookup: HTTP ${res.status}` };
      }
      const user = (await res.json()) as { primaryEmail?: string };
      return { ok: true, message: `Token acquired and directory user "${user.primaryEmail ?? impersonatedAdminEmail}" confirmed` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
