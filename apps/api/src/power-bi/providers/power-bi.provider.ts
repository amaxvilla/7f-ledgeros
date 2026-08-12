import { Injectable, OnModuleInit } from '@nestjs/common';
import { acquirePowerBiToken } from '@7f/config';
import { IntegrationsService } from '../../integrations/integrations.service';
import { PowerBiProviderRegistry } from '../power-bi-provider.registry';
import {
  PowerBiProvider,
  PublishDatasetParams,
  PublishDatasetResult,
  PushRowsParams,
  TriggerRefreshParams,
  RefreshStatusResult,
  RefreshStatus,
  EmbedConfigParams,
  EmbedConfigResult,
} from '../power-bi-provider.interface';

export const POWER_BI_PROVIDER_CODE = 'POWER_BI';
const POWER_BI_API_BASE_URL = 'https://api.powerbi.com/v1.0/myorg';

interface ResolvedPowerBiConfig {
  tenantId: string;
  clientId: string;
  workspaceId: string;
  clientSecret: string;
}

/**
 * Power BI, Checkpoint D — the concrete `PowerBiProvider`, built on
 * Checkpoint B's `acquirePowerBiToken` and Checkpoint C's credential
 * shape, the same "provider before caller" sequencing every other
 * provider family in this codebase already used.
 *
 * SCOPING NOTE: the recommendation that led to this checkpoint floated
 * splitting the interface's three capabilities (Dataset Publishing,
 * Scheduled Refresh, Embedded Reports) into their own D/E/F
 * checkpoints. On reflection this checkpoint implements all five
 * methods together instead — `GoogleWorkspaceAdminProvider` (Checkpoint
 * H, a separate release) implemented its own four interface methods in
 * one checkpoint with no real difficulty, and each of these five is
 * similarly a single, independently-testable HTTP call, not a
 * multi-step workflow — so splitting further would trade one
 * comparably-sized, cleanly-testable checkpoint for three much smaller
 * ones without a real complexity reason to. Recorded here as a
 * deliberate judgment call, not a silent scope change.
 *
 * OWN DEDICATED IntegrationProvider ROW (POWER_BI_PROVIDER_ID env var,
 * category POWER_BI, providerCode "POWER_BI") — Checkpoint C's own doc
 * comment already established this shape; this provider just consumes
 * it, the same way GoogleWorkspaceAdminProvider consumes Checkpoint G's.
 *
 * Every call is scoped to `config.workspaceId` (Power BI's REST API has
 * no "default" workspace for a service principal — see Checkpoint C's
 * own doc comment) and authenticated via `acquirePowerBiToken` using the
 * full (non-read-only) token — the health-check driver's own token
 * carries the same scope by construction (Azure AD's `.default` scope
 * grants whatever app-role the Azure AD app registration was assigned,
 * not a narrower slice per call), so unlike `GoogleWorkspaceAdminProvider`
 * there is no separate "narrower read-only scope" to request here.
 */
@Injectable()
export class PowerBiProviderImpl implements PowerBiProvider, OnModuleInit {
  private resolved: Promise<ResolvedPowerBiConfig> | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly registry: PowerBiProviderRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(POWER_BI_PROVIDER_CODE, this);
  }

  async publishDataset(params: PublishDatasetParams): Promise<PublishDatasetResult> {
    const config = await this.getConfig();
    const token = await this.getToken(config);

    const res = await fetch(`${POWER_BI_API_BASE_URL}/groups/${encodeURIComponent(config.workspaceId)}/datasets`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.datasetName,
        defaultMode: 'Push',
        tables: params.tables.map((t) => ({
          name: t.name,
          columns: t.columns.map((c) => ({ name: c.name, dataType: this.mapColumnType(c.dataType) })),
        })),
      }),
    });
    const body = await this.parseJson(res);
    if (!res.ok) {
      throw new Error(`Power BI datasets.postDataset failed: HTTP ${res.status} — ${this.errorMessage(body)}`);
    }
    const id = (body as { id?: string }).id;
    if (!id) throw new Error('Power BI datasets.postDataset succeeded but returned no id');
    return { providerDatasetId: id };
  }

  async pushRows(params: PushRowsParams): Promise<void> {
    const config = await this.getConfig();
    const token = await this.getToken(config);

    const res = await fetch(
      `${POWER_BI_API_BASE_URL}/groups/${encodeURIComponent(config.workspaceId)}/datasets/${encodeURIComponent(params.providerDatasetId)}/tables/${encodeURIComponent(params.tableName)}/rows`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: params.rows }),
      },
    );
    if (!res.ok) {
      const body = await this.parseJson(res);
      throw new Error(`Power BI datasets.postRows failed: HTTP ${res.status} — ${this.errorMessage(body)}`);
    }
  }

  async triggerRefresh(params: TriggerRefreshParams): Promise<void> {
    const config = await this.getConfig();
    const token = await this.getToken(config);

    const res = await fetch(
      `${POWER_BI_API_BASE_URL}/groups/${encodeURIComponent(config.workspaceId)}/datasets/${encodeURIComponent(params.providerDatasetId)}/refreshes`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyOption: 'NoNotification' }),
      },
    );
    if (!res.ok) {
      const body = await this.parseJson(res);
      throw new Error(`Power BI datasets.refreshes (trigger) failed: HTTP ${res.status} — ${this.errorMessage(body)}`);
    }
  }

  async getRefreshStatus(providerDatasetId: string): Promise<RefreshStatusResult> {
    const config = await this.getConfig();
    const token = await this.getToken(config);

    const res = await fetch(
      `${POWER_BI_API_BASE_URL}/groups/${encodeURIComponent(config.workspaceId)}/datasets/${encodeURIComponent(providerDatasetId)}/refreshes?$top=1`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await this.parseJson(res);
    if (!res.ok) {
      throw new Error(`Power BI datasets.getRefreshHistory failed: HTTP ${res.status} — ${this.errorMessage(body)}`);
    }
    const entries = (body as { value?: Array<{ status?: string; endTime?: string }> }).value ?? [];
    return { status: this.mapRefreshStatus(entries[0]) };
  }

  async getEmbedConfig(params: EmbedConfigParams): Promise<EmbedConfigResult> {
    const config = await this.getConfig();
    const token = await this.getToken(config);
    const groupPath = `${POWER_BI_API_BASE_URL}/groups/${encodeURIComponent(config.workspaceId)}`;
    const reportPath = `${groupPath}/reports/${encodeURIComponent(params.providerReportId)}`;

    const reportRes = await fetch(reportPath, { headers: { Authorization: `Bearer ${token}` } });
    const reportBody = await this.parseJson(reportRes);
    if (!reportRes.ok) {
      throw new Error(`Power BI reports.getReport failed: HTTP ${reportRes.status} — ${this.errorMessage(reportBody)}`);
    }
    const embedUrl = (reportBody as { embedUrl?: string }).embedUrl;
    if (!embedUrl) throw new Error('Power BI reports.getReport succeeded but returned no embedUrl');

    const tokenRes = await fetch(`${reportPath}/GenerateToken`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessLevel: 'View' }),
    });
    const tokenBody = await this.parseJson(tokenRes);
    if (!tokenRes.ok) {
      throw new Error(`Power BI reports.generateToken failed: HTTP ${tokenRes.status} — ${this.errorMessage(tokenBody)}`);
    }
    const { token: embedToken, expiration } = tokenBody as { token?: string; expiration?: string };
    if (!embedToken || !expiration) {
      throw new Error('Power BI reports.generateToken succeeded but returned no token/expiration');
    }
    return { embedUrl, accessToken: embedToken, expiresAt: new Date(expiration) };
  }

  /**
   * Power BI's refresh-history entries don't report "InProgress" as a
   * `status` string the way the rest of the vocabulary suggests — an
   * still-running refresh is the most recent entry with no `endTime`
   * yet, regardless of what (if anything) `status` says. Checked first,
   * before the `status` switch, for that reason.
   *
   * NOTE on the interface's own doc comment: `power-bi-provider.interface.ts`
   * describes the vocabulary as "Unknown/InProgress/Completed/Failed/
   * Disabled" (five states) but the `RefreshStatus` type it actually
   * defines only has four (`UNKNOWN | IN_PROGRESS | COMPLETED | FAILED`)
   * — `Disabled` was named in prose but never given its own union
   * member. Rather than silently deciding this alone, it's mapped to
   * `UNKNOWN` below (the closer of the two available options — a
   * disabled refresh schedule isn't a failure of any particular run)
   * and flagged in this checkpoint's own report as worth a real decision
   * later, not asserted as obviously correct.
   */
  private mapRefreshStatus(entry: { status?: string; endTime?: string } | undefined): RefreshStatus {
    if (!entry) return 'UNKNOWN';
    if (!entry.endTime) return 'IN_PROGRESS';
    switch (entry.status) {
      case 'Completed':
        return 'COMPLETED';
      case 'Failed':
        return 'FAILED';
      default:
        return 'UNKNOWN';
    }
  }

  private mapColumnType(dataType: PublishDatasetParams['tables'][number]['columns'][number]['dataType']): string {
    switch (dataType) {
      case 'string':
        return 'string';
      case 'number':
        return 'double';
      case 'boolean':
        return 'bool';
      case 'dateTime':
        return 'dateTime';
    }
  }

  private async getToken(config: ResolvedPowerBiConfig): Promise<string> {
    return acquirePowerBiToken(config.tenantId, config.clientId, config.clientSecret);
  }

  private async getConfig(): Promise<ResolvedPowerBiConfig> {
    if (!this.resolved) {
      this.resolved = this.resolveConfig();
    }
    return this.resolved;
  }

  private async resolveConfig(): Promise<ResolvedPowerBiConfig> {
    const providerId = process.env.POWER_BI_PROVIDER_ID;
    if (!providerId) {
      throw new Error(
        'POWER_BI_PROVIDER_ID is not set. Create an IntegrationProvider (category POWER_BI, providerCode "POWER_BI") with config {tenantId, clientId, workspaceId} and credentials {clientSecret}, then set POWER_BI_PROVIDER_ID to its id.',
      );
    }

    const provider = await this.integrations.getProvider(providerId);
    if (provider.providerCode !== POWER_BI_PROVIDER_CODE) {
      throw new Error(`Integration provider ${providerId} is providerCode "${provider.providerCode}", expected "${POWER_BI_PROVIDER_CODE}"`);
    }
    if (!provider.isActive) {
      throw new Error(`Integration provider ${providerId} (${POWER_BI_PROVIDER_CODE}) is not active`);
    }

    const config = (provider.config as Record<string, unknown> | null) ?? {};
    const tenantId = config.tenantId as string | undefined;
    const clientId = config.clientId as string | undefined;
    const workspaceId = config.workspaceId as string | undefined;
    const missingConfig = [!tenantId && 'tenantId', !clientId && 'clientId', !workspaceId && 'workspaceId'].filter(Boolean);
    if (missingConfig.length) {
      throw new Error(`Integration provider ${providerId} is missing config.${missingConfig.join(', config.')}`);
    }

    const credentials = await this.integrations.getDecryptedCredentials(providerId);
    const clientSecret = credentials?.clientSecret as string | undefined;
    if (!clientSecret) {
      throw new Error(`Integration provider ${providerId} is missing credentials.clientSecret`);
    }

    return { tenantId: tenantId!, clientId: clientId!, workspaceId: workspaceId!, clientSecret };
  }

  private errorMessage(body: unknown): string {
    return (body as { error?: { message?: string } })?.error?.message ?? 'unknown error';
  }

  private async parseJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }
}
