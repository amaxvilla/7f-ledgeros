import { PowerBiService } from '../power-bi.service';

describe('PowerBiService', () => {
  let registry: { get: jest.Mock };
  let provider: {
    publishDataset: jest.Mock;
    pushRows: jest.Mock;
    triggerRefresh: jest.Mock;
    getRefreshStatus: jest.Mock;
    getEmbedConfig: jest.Mock;
  };
  let service: PowerBiService;

  beforeEach(() => {
    provider = {
      publishDataset: jest.fn().mockResolvedValue({ providerDatasetId: 'ds1' }),
      pushRows: jest.fn().mockResolvedValue(undefined),
      triggerRefresh: jest.fn().mockResolvedValue(undefined),
      getRefreshStatus: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
      getEmbedConfig: jest.fn().mockResolvedValue({ embedUrl: 'https://app.powerbi.com/x', accessToken: 'tok', expiresAt: new Date('2026-08-01T00:00:00.000Z') }),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    service = new PowerBiService(registry as any);
  });

  describe('publishDataset', () => {
    it('resolves the provider by providerCode and forwards the schema', async () => {
      const tables = [{ name: 'TrialBalance', columns: [{ name: 'account', dataType: 'string' as const }] }];
      const result = await service.publishDataset({ providerCode: 'POWER_BI', datasetName: 'GL Dataset', tables });

      expect(registry.get).toHaveBeenCalledWith('POWER_BI');
      expect(provider.publishDataset).toHaveBeenCalledWith({ datasetName: 'GL Dataset', tables });
      expect(result).toEqual({ providerDatasetId: 'ds1' });
    });
  });

  describe('pushRows', () => {
    it('passes providerDatasetId alongside tableName/rows', async () => {
      const rows = [{ account: '1000', balance: 500 }];
      await service.pushRows('ds1', { providerCode: 'POWER_BI', tableName: 'TrialBalance', rows });

      expect(provider.pushRows).toHaveBeenCalledWith({ providerDatasetId: 'ds1', tableName: 'TrialBalance', rows });
    });
  });

  describe('triggerRefresh', () => {
    it('resolves the provider and forwards providerDatasetId', async () => {
      await service.triggerRefresh('ds1', { providerCode: 'POWER_BI' });
      expect(provider.triggerRefresh).toHaveBeenCalledWith({ providerDatasetId: 'ds1' });
    });
  });

  describe('getRefreshStatus', () => {
    it('resolves the provider and forwards providerDatasetId', async () => {
      const result = await service.getRefreshStatus('ds1', 'POWER_BI');
      expect(registry.get).toHaveBeenCalledWith('POWER_BI');
      expect(provider.getRefreshStatus).toHaveBeenCalledWith('ds1');
      expect(result).toEqual({ status: 'COMPLETED' });
    });
  });

  describe('getEmbedConfig', () => {
    it('resolves the provider and forwards providerReportId', async () => {
      const result = await service.getEmbedConfig('rpt1', 'POWER_BI');
      expect(provider.getEmbedConfig).toHaveBeenCalledWith({ providerReportId: 'rpt1' });
      expect(result.embedUrl).toBe('https://app.powerbi.com/x');
    });
  });

  it('propagates the registry error for an unregistered providerCode rather than swallowing it', async () => {
    registry.get.mockImplementation(() => {
      throw new Error('No Power BI provider registered for providerCode "TABLEAU"');
    });

    await expect(
      service.publishDataset({ providerCode: 'TABLEAU', datasetName: 'x', tables: [] }),
    ).rejects.toThrow('No Power BI provider registered for providerCode "TABLEAU"');
  });
});
