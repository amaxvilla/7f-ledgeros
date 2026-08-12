import { IntegrationHealthCheckResult, IntegrationProviderDriver } from '../../integrations/integration-provider-driver.interface';
import { acquirePowerBiToken } from '@7f/config';

export const POWER_BI_PROVIDER_CODE = 'POWER_BI';

/**
 * Power BI, Checkpoint C — decides and proves the `IntegrationProvider`
 * credential/config shape for Power BI, the same "credential shape +
 * health-check driver" step Checkpoint G was for Google Workspace Admin.
 * No Prisma change needed: `IntegrationProvider.config`/
 * `.encryptedCredentials` are already free-form JSON — this is a driver-
 * enforced convention, not a migration.
 *
 * Shape mirrors MicrosoftGraphEmailHealthCheckDriver's own
 * config.tenantId/config.clientId + credentials.clientSecret split
 * exactly (same Azure AD tenant/client-credentials flow underneath,
 * via acquirePowerBiToken from Checkpoint B instead of
 * acquireMicrosoftGraphToken) — tenantId/clientId aren't secret, so they
 * live in config; only clientSecret is encrypted credentials:
 *  - config.tenantId — the Azure AD tenant this service principal
 *    belongs to.
 *  - config.clientId — the Azure AD app registration's client (application) id.
 *  - config.workspaceId — the Power BI workspace (group) this row
 *    operates against. Every dataset-publishing/refresh/embed call a
 *    future concrete provider makes is scoped to one workspace
 *    (Power BI's REST API has no "default" workspace for a service
 *    principal), so unlike tenantId/clientId this is Power-BI-specific,
 *    not shared with any Microsoft Graph row.
 *  - credentials.clientSecret — the Azure AD app registration's client
 *    secret. The one field that actually needs encryption at rest.
 *
 * Health check: acquire a token, then one cheap read-only GET —
 * `GET /v1.0/myorg/groups/{workspaceId}` — confirming the configured
 * workspace is actually reachable by this service principal, the same
 * "verify a specific resource, not just that a token was issued"
 * posture GoogleDriveHealthCheckDriver/
 * GoogleWorkspaceAdminHealthCheckDriver both already use (a token can be
 * issued for a workspace the service principal was never actually
 * granted access to in the Power BI admin portal — Azure AD and Power
 * BI's own per-workspace permission model are two separate checks).
 *
 * Registered as a fresh providerCode, `POWER_BI`, under the pre-existing
 * `POWER_BI` `IntegrationCategory` — there is exactly one Power BI
 * credential shape needed so far (unlike GOOGLE_WORKSPACE, which has to
 * distinguish GOOGLE_DRIVE/GOOGLE_WORKSPACE_ADMIN's very different
 * credential shapes under one category), so no naming collision
 * consideration applies here the way it did for Checkpoint G's own
 * "why a fresh providerCode" reasoning.
 *
 * Still no concrete `PowerBiProvider` bound to `PowerBiProviderRegistry`
 * — that remains the next checkpoint, per Checkpoint A's own scoping.
 */
export class PowerBiHealthCheckDriver implements IntegrationProviderDriver {
  async healthCheck(params: {
    config: Record<string, unknown> | null;
    credentials: Record<string, unknown> | null;
  }): Promise<IntegrationHealthCheckResult> {
    const tenantId = params.config?.tenantId as string | undefined;
    const clientId = params.config?.clientId as string | undefined;
    const workspaceId = params.config?.workspaceId as string | undefined;
    const clientSecret = params.credentials?.clientSecret as string | undefined;

    const missingConfig = ['tenantId', 'clientId', 'workspaceId'].filter((k) => !params.config?.[k]);
    if (missingConfig.length) {
      return { ok: false, message: `Missing config.${missingConfig.join(', config.')}` };
    }
    if (!clientSecret) {
      return { ok: false, message: 'Missing credentials.clientSecret' };
    }

    let accessToken: string;
    try {
      accessToken = await acquirePowerBiToken(tenantId!, clientId!, clientSecret);
    } catch (err) {
      return { ok: false, message: `Token acquisition failed: ${(err as Error).message}` };
    }

    try {
      const res = await fetch(`https://api.powerbi.com/v1.0/myorg/groups/${encodeURIComponent(workspaceId!)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        return { ok: false, message: `Power BI rejected the workspace lookup: HTTP ${res.status}` };
      }
      const workspace = (await res.json()) as { name?: string };
      return { ok: true, message: `Token acquired and workspace "${workspace.name ?? workspaceId}" confirmed` };
    } catch (err) {
      return { ok: false, message: (err as Error).message };
    }
  }
}
