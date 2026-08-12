import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationHealthCheckProcessor } from './integration-health-check.processor';
import { InternalApiClient } from '../internal-api/internal-api-client';
import { JobRunLogService } from '../jobs/job-run-log.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

function makeJob(data: Record<string, unknown>) {
  return { id: 'job-1', name: 'scheduled-health-check-all', data, attemptsMade: 0 } as any;
}

describe('IntegrationHealthCheckProcessor', () => {
  let processor: IntegrationHealthCheckProcessor;
  let api: { get: jest.Mock; post: jest.Mock };
  let featureFlags: { isEnabled: jest.Mock };

  beforeEach(async () => {
    api = { get: jest.fn(), post: jest.fn() };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationHealthCheckProcessor,
        { provide: InternalApiClient, useValue: api },
        { provide: JobRunLogService, useValue: { recordStart: jest.fn(), recordSuccess: jest.fn(), recordFailure: jest.fn() } },
        { provide: FeatureFlagsService, useValue: featureFlags },
      ],
    }).compile();

    processor = module.get(IntegrationHealthCheckProcessor);
  });

  it('calls health-check-all when no specific provider id is given', async () => {
    api.post.mockResolvedValue({ checked: 3, healthy: 2 });

    const result = await processor.process(makeJob({}));

    expect(api.post).toHaveBeenCalledWith('/integrations/health-check-all');
    expect(result).toEqual({ checked: 3, healthy: 2 });
  });

  it('calls the single-provider endpoint when a provider id is given', async () => {
    api.post.mockResolvedValue({ id: 'ip1', status: 'ACTIVE' });

    await processor.process(makeJob({ integrationProviderId: 'ip1' }));

    expect(api.post).toHaveBeenCalledWith('/integrations/ip1/health-check');
  });

  it('skips processing when the feature flag is disabled', async () => {
    featureFlags.isEnabled.mockResolvedValue(false);

    const result = await processor.process(makeJob({}));

    expect(result).toEqual({ skipped: true });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rethrows on failure', async () => {
    api.post.mockRejectedValue(new Error('API unreachable'));
    await expect(processor.process(makeJob({}))).rejects.toThrow('API unreachable');
  });
});
