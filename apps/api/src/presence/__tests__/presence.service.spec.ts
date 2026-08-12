import { PresenceService } from '../presence.service';

describe('PresenceService', () => {
  let registry: { get: jest.Mock };
  let provider: { getPresence: jest.Mock };
  let service: PresenceService;

  beforeEach(() => {
    provider = { getPresence: jest.fn().mockResolvedValue({ availability: 'Available', activity: 'Available' }) };
    registry = { get: jest.fn().mockReturnValue(provider) };
    service = new PresenceService(registry as any);
  });

  it('resolves the provider by providerCode and forwards userIdentifier', async () => {
    const result = await service.getPresence('MS_GRAPH', 'recruiter@7fifteencapital.com');

    expect(registry.get).toHaveBeenCalledWith('MS_GRAPH');
    expect(provider.getPresence).toHaveBeenCalledWith('recruiter@7fifteencapital.com');
    expect(result).toEqual({ availability: 'Available', activity: 'Available' });
  });

  it('propagates the registry error for an unregistered providerCode rather than swallowing it', async () => {
    registry.get.mockImplementation(() => {
      throw new Error('No presence provider registered for providerCode "SLACK"');
    });

    await expect(service.getPresence('SLACK', 'a@b.com')).rejects.toThrow(
      'No presence provider registered for providerCode "SLACK"',
    );
  });
});
