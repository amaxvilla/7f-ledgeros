import { Test } from '@nestjs/testing';
import { PowerBiProviderImpl, POWER_BI_PROVIDER_CODE } from '../providers/power-bi.provider';
import { PowerBiProviderRegistry } from '../power-bi-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'pbi-token-xyz' }) };
}

describe('PowerBiProviderImpl', () => {
  let provider: PowerBiProviderImpl;
  let registry: PowerBiProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  const validProviderRow = {
    id: 'provider-1',
    providerCode: 'POWER_BI',
    isActive: true,
    config: { tenantId: 'tenant-1', clientId: 'client-1', workspaceId: 'workspace-1' },
  };

  beforeEach(async () => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, POWER_BI_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'super-secret' }),
    };
    registry = new PowerBiProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        PowerBiProviderImpl,
        { provide: IntegrationsService, useValue: integrations },
        { provide: PowerBiProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(PowerBiProviderImpl);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into PowerBiProviderRegistry under "POWER_BI"', () => {
      expect(registry.isRegistered(POWER_BI_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(POWER_BI_PROVIDER_CODE)).toBe(true);
      expect(registry.get(POWER_BI_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('publishDataset', () => {
    const params = {
      datasetName: 'Financial Core Trial Balance',
      tables: [{ name: 'TrialBalance', columns: [{ name: 'Account', dataType: 'string' as const }, { name: 'Balance', dataType: 'number' as const }] }],
    };

    it('POSTs to datasets with mapped column types and returns the id', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'dataset-1' }) });

      const result = await provider.publishDataset(params);

      expect(result).toEqual({ providerDatasetId: 'dataset-1' });
      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/workspace-1/datasets');
      expect(call[1].method).toBe('POST');
      const body = JSON.parse(call[1].body);
      expect(body.name).toBe('Financial Core Trial Balance');
      expect(body.defaultMode).toBe('Push');
      expect(body.tables[0]).toEqual({ name: 'TrialBalance', columns: [{ name: 'Account', dataType: 'string' }, { name: 'Balance', dataType: 'double' }] });
    });

    it('throws a descriptive error when Power BI rejects the request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid dataset schema' } }) });
      await expect(provider.publishDataset(params)).rejects.toThrow('Invalid dataset schema');
    });

    it('throws when the response has no id', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await expect(provider.publishDataset(params)).rejects.toThrow('returned no id');
    });
  });

  describe('pushRows', () => {
    it('POSTs rows to the correct table URL', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.pushRows({ providerDatasetId: 'dataset-1', tableName: 'TrialBalance', rows: [{ Account: 'Cash', Balance: 100 }] });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/workspace-1/datasets/dataset-1/tables/TrialBalance/rows');
      expect(JSON.parse(call[1].body)).toEqual({ rows: [{ Account: 'Cash', Balance: 100 }] });
    });

    it('throws a descriptive error on failure', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Table not found' } }) });
      await expect(provider.pushRows({ providerDatasetId: 'd1', tableName: 'X', rows: [] })).rejects.toThrow('Table not found');
    });
  });

  describe('triggerRefresh', () => {
    it('POSTs to the refreshes endpoint', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await provider.triggerRefresh({ providerDatasetId: 'dataset-1' });
      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/workspace-1/datasets/dataset-1/refreshes');
      expect(call[1].method).toBe('POST');
    });

    it('throws a descriptive error on failure', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: { message: 'Refresh already in progress' } }) });
      await expect(provider.triggerRefresh({ providerDatasetId: 'd1' })).rejects.toThrow('Refresh already in progress');
    });
  });

  describe('getRefreshStatus', () => {
    it('maps a completed refresh', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [{ status: 'Completed', endTime: '2026-07-31T00:00:00Z' }] }) });
      expect(await provider.getRefreshStatus('dataset-1')).toEqual({ status: 'COMPLETED' });
    });

    it('maps a failed refresh', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [{ status: 'Failed', endTime: '2026-07-31T00:00:00Z' }] }) });
      expect(await provider.getRefreshStatus('dataset-1')).toEqual({ status: 'FAILED' });
    });

    it('maps a still-running refresh (no endTime) to IN_PROGRESS regardless of status', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [{ status: 'Unknown' }] }) });
      expect(await provider.getRefreshStatus('dataset-1')).toEqual({ status: 'IN_PROGRESS' });
    });

    it('maps an empty history to UNKNOWN', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });
      expect(await provider.getRefreshStatus('dataset-1')).toEqual({ status: 'UNKNOWN' });
    });

    it('requests only the single most recent entry', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });
      await provider.getRefreshStatus('dataset-1');
      expect(fetchMock.mock.calls[1][0]).toContain('$top=1');
    });
  });

  describe('getEmbedConfig', () => {
    it('fetches the report then generates an embed token', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ embedUrl: 'https://app.powerbi.com/embed?reportId=r1' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'embed-tok', expiration: '2026-07-31T01:00:00Z' }) });

      const result = await provider.getEmbedConfig({ providerReportId: 'r1' });

      expect(result.embedUrl).toBe('https://app.powerbi.com/embed?reportId=r1');
      expect(result.accessToken).toBe('embed-tok');
      expect(result.expiresAt).toEqual(new Date('2026-07-31T01:00:00Z'));
      expect(fetchMock.mock.calls[1][0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/workspace-1/reports/r1');
      expect(fetchMock.mock.calls[2][0]).toBe('https://api.powerbi.com/v1.0/myorg/groups/workspace-1/reports/r1/GenerateToken');
    });

    it('throws when the report lookup fails', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Report not found' } }) });
      await expect(provider.getEmbedConfig({ providerReportId: 'missing' })).rejects.toThrow('Report not found');
    });

    it('throws when GenerateToken fails', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ embedUrl: 'https://x' }) })
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient scope' } }) });
      await expect(provider.getEmbedConfig({ providerReportId: 'r1' })).rejects.toThrow('Insufficient scope');
    });
  });

  describe('resolveConfig', () => {
    it('throws when POWER_BI_PROVIDER_ID is not set', async () => {
      delete process.env.POWER_BI_PROVIDER_ID;
      await expect(provider.getRefreshStatus('d1')).rejects.toThrow('POWER_BI_PROVIDER_ID is not set');
    });

    it('throws on providerCode mismatch', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'GOOGLE_DRIVE' });
      await expect(provider.getRefreshStatus('d1')).rejects.toThrow('expected "POWER_BI"');
    });

    it('throws when inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.getRefreshStatus('d1')).rejects.toThrow('is not active');
    });

    it('throws when config is missing a key', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: { tenantId: 't' } });
      await expect(provider.getRefreshStatus('d1')).rejects.toThrow('config.clientId, config.workspaceId');
    });

    it('throws when credentials.clientSecret is missing', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.getRefreshStatus('d1')).rejects.toThrow('credentials.clientSecret');
    });

    it('caches the resolved config across multiple calls', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) })
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });

      await provider.getRefreshStatus('d1');
      await provider.getRefreshStatus('d1');

      expect(integrations.getProvider).toHaveBeenCalledTimes(1);
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });
  });
});
