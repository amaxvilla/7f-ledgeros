import { Test } from '@nestjs/testing';
import { MicrosoftGraphPresenceProvider, MS_GRAPH_PRESENCE_PROVIDER_CODE } from '../providers/microsoft-graph-presence.provider';
import { PresenceProviderRegistry } from '../presence-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'graph-token-xyz', expires_in: 3600 }) };
}

function presenceResponse(body: Record<string, unknown>) {
  return { ok: true, json: async () => body };
}

describe('MicrosoftGraphPresenceProvider', () => {
  let provider: MicrosoftGraphPresenceProvider;
  let registry: PresenceProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  // Note: senderUserId is present on the shared row (other Graph
  // providers need it) but this provider doesn't read it — see the
  // provider's own resolveConfig() comment.
  const validProviderRow = {
    id: 'provider-1',
    providerCode: 'MS_GRAPH_EMAIL',
    isActive: true,
    config: { tenantId: 'tenant-1', clientId: 'client-1', senderUserId: 'sender@example.com' },
  };

  beforeEach(async () => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, EMAIL_SMTP_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'shh' }),
    };
    registry = new PresenceProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MicrosoftGraphPresenceProvider,
        { provide: IntegrationsService, useValue: integrations },
        { provide: PresenceProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(MicrosoftGraphPresenceProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into PresenceProviderRegistry under "MS_GRAPH"', () => {
      expect(registry.isRegistered(MS_GRAPH_PRESENCE_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(MS_GRAPH_PRESENCE_PROVIDER_CODE)).toBe(true);
      expect(registry.get(MS_GRAPH_PRESENCE_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('getPresence', () => {
    it('fetches the token, then the presence resource, mapping availability/activity through', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(presenceResponse({ id: 'user-1', availability: 'Busy', activity: 'InAMeeting' }));

      const result = await provider.getPresence('jane@example.com');

      expect(result).toEqual({ availability: 'Busy', activity: 'InAMeeting' });

      const presenceCall = fetchMock.mock.calls[1];
      expect(presenceCall[0]).toBe('https://graph.microsoft.com/v1.0/users/jane%40example.com/presence');
      expect(presenceCall[1].headers.Authorization).toBe('Bearer graph-token-xyz');
    });

    it('URL-encodes the userIdentifier', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(presenceResponse({ availability: 'Available', activity: 'Available' }));

      await provider.getPresence('some id/with#special?chars');

      expect(fetchMock.mock.calls[1][0]).toContain(encodeURIComponent('some id/with#special?chars'));
    });

    it('falls back to PresenceUnknown for a 200 response missing a field, rather than throwing', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(presenceResponse({}));

      const result = await provider.getPresence('jane@example.com');
      expect(result).toEqual({ availability: 'PresenceUnknown', activity: 'PresenceUnknown' });
    });

    it('caches the resolved config/token setup across repeated calls (only re-fetches the token, not the config)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(presenceResponse({ availability: 'Available', activity: 'Available' }))
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(presenceResponse({ availability: 'Away', activity: 'Away' }));

      await provider.getPresence('jane@example.com');
      await provider.getPresence('john@example.com');

      expect(integrations.getProvider).toHaveBeenCalledTimes(1);
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });

    it('surfaces a Graph error response (e.g. missing Presence.Read.All grant) with a clear message', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Insufficient privileges to complete the operation.' } }),
      });

      await expect(provider.getPresence('jane@example.com')).rejects.toThrow(
        /Microsoft Graph get presence failed: HTTP 403 — Insufficient privileges/,
      );
    });

    it('handles a non-JSON error response without throwing a secondary parse error', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      });

      await expect(provider.getPresence('jane@example.com')).rejects.toThrow(/HTTP 500 — unknown error/);
    });
  });

  describe('resolveConfig', () => {
    it('throws when EMAIL_SMTP_PROVIDER_ID is not set', async () => {
      delete process.env.EMAIL_SMTP_PROVIDER_ID;
      await expect(provider.getPresence('jane@example.com')).rejects.toThrow('EMAIL_SMTP_PROVIDER_ID is not set');
    });

    it('throws when the referenced provider is not providerCode MS_GRAPH_EMAIL', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'SMTP' });
      await expect(provider.getPresence('jane@example.com')).rejects.toThrow('expected "MS_GRAPH_EMAIL"');
    });

    it('throws when the provider is not active', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.getPresence('jane@example.com')).rejects.toThrow('is not active');
    });

    it('throws listing missing config keys (tenantId/clientId only — senderUserId is not required here)', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: { senderUserId: 'x@example.com' } });
      await expect(provider.getPresence('jane@example.com')).rejects.toThrow('missing config.tenantId, config.clientId');
    });

    it('does not require senderUserId, unlike the Calendar/Tasks/Contacts providers', async () => {
      integrations.getProvider.mockResolvedValue({
        ...validProviderRow,
        config: { tenantId: 'tenant-1', clientId: 'client-1' }, // no senderUserId at all
      });
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(presenceResponse({ availability: 'Available', activity: 'Available' }));

      await expect(provider.getPresence('jane@example.com')).resolves.toEqual({
        availability: 'Available',
        activity: 'Available',
      });
    });

    it('throws when credentials.clientSecret is missing', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.getPresence('jane@example.com')).rejects.toThrow('missing credentials.clientSecret');
    });
  });
});
