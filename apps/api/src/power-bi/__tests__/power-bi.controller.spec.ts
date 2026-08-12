import { PowerBiController } from '../power-bi.controller';

describe('PowerBiController', () => {
  let powerBi: {
    publishDataset: jest.Mock;
    pushRows: jest.Mock;
    triggerRefresh: jest.Mock;
    getRefreshStatus: jest.Mock;
    getEmbedConfig: jest.Mock;
  };
  let controller: PowerBiController;

  beforeEach(() => {
    powerBi = {
      publishDataset: jest.fn().mockResolvedValue({ providerDatasetId: 'ds1' }),
      pushRows: jest.fn().mockResolvedValue(undefined),
      triggerRefresh: jest.fn().mockResolvedValue(undefined),
      getRefreshStatus: jest.fn().mockResolvedValue({ status: 'COMPLETED' }),
      getEmbedConfig: jest.fn().mockResolvedValue({ embedUrl: 'https://app.powerbi.com/x' }),
    };
    controller = new PowerBiController(powerBi as any);
  });

  it('publishDataset() delegates to PowerBiService.publishDataset', async () => {
    const dto = { providerCode: 'POWER_BI', datasetName: 'GL', tables: [] } as any;
    const result = await controller.publishDataset(dto);

    expect(powerBi.publishDataset).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ providerDatasetId: 'ds1' });
  });

  it('pushRows() delegates with the path param', async () => {
    const dto = { providerCode: 'POWER_BI', tableName: 'GL', rows: [{}] } as any;
    await controller.pushRows('ds1', dto);

    expect(powerBi.pushRows).toHaveBeenCalledWith('ds1', dto);
  });

  it('triggerRefresh() delegates with the path param', async () => {
    const dto = { providerCode: 'POWER_BI' } as any;
    await controller.triggerRefresh('ds1', dto);

    expect(powerBi.triggerRefresh).toHaveBeenCalledWith('ds1', dto);
  });

  it('getRefreshStatus() delegates with the path param and query providerCode', async () => {
    const result = await controller.getRefreshStatus('ds1', { providerCode: 'POWER_BI' } as any);

    expect(powerBi.getRefreshStatus).toHaveBeenCalledWith('ds1', 'POWER_BI');
    expect(result).toEqual({ status: 'COMPLETED' });
  });

  it('getEmbedConfig() delegates with the path param and query providerCode', async () => {
    const result = await controller.getEmbedConfig('rpt1', { providerCode: 'POWER_BI' } as any);

    expect(powerBi.getEmbedConfig).toHaveBeenCalledWith('rpt1', 'POWER_BI');
    expect(result).toEqual({ embedUrl: 'https://app.powerbi.com/x' });
  });
});
