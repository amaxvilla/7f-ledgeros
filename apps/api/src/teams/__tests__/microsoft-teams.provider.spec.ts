import { Test } from '@nestjs/testing';
import { MicrosoftTeamsProvider, MS_GRAPH_TEAMS_PROVIDER_CODE } from '../providers/microsoft-teams.provider';
import { TeamsProviderRegistry } from '../teams-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'graph-token-xyz', expires_in: 3600 }) };
}

function meetingResponse(body: Record<string, unknown>) {
  return { ok: true, json: async () => body };
}

describe('MicrosoftTeamsProvider', () => {
  let provider: MicrosoftTeamsProvider;
  let registry: TeamsProviderRegistry;
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

  const meetingParams = {
    subject: 'Panel interview — Ada Obi',
    startTime: new Date('2026-08-05T10:00:00Z'),
    endTime: new Date('2026-08-05T10:45:00Z'),
    organizerIdentifier: 'jane@example.com',
  };

  beforeEach(async () => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, EMAIL_SMTP_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'shh' }),
    };
    registry = new TeamsProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MicrosoftTeamsProvider,
        { provide: IntegrationsService, useValue: integrations },
        { provide: TeamsProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(MicrosoftTeamsProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into TeamsProviderRegistry under "MS_GRAPH"', () => {
      expect(registry.isRegistered(MS_GRAPH_TEAMS_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(MS_GRAPH_TEAMS_PROVIDER_CODE)).toBe(true);
      expect(registry.get(MS_GRAPH_TEAMS_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('createMeeting', () => {
    it('fetches the token, then creates the online meeting under the organizer, mapping joinWebUrl through', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(meetingResponse({ id: 'meeting-1', joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/abc' }));

      const result = await provider.createMeeting(meetingParams);

      expect(result).toEqual({ providerMeetingId: 'meeting-1', joinUrl: 'https://teams.microsoft.com/l/meetup-join/abc' });

      const createCall = fetchMock.mock.calls[1];
      expect(createCall[0]).toBe('https://graph.microsoft.com/v1.0/users/jane%40example.com/onlineMeetings');
      expect(createCall[1].method).toBe('POST');
      expect(createCall[1].headers.Authorization).toBe('Bearer graph-token-xyz');
      expect(JSON.parse(createCall[1].body)).toEqual({
        subject: 'Panel interview — Ada Obi',
        startDateTime: '2026-08-05T10:00:00.000Z',
        endDateTime: '2026-08-05T10:45:00.000Z',
      });
    });

    it('URL-encodes the organizerIdentifier', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(meetingResponse({ id: 'meeting-1', joinWebUrl: 'https://x' }));

      await provider.createMeeting({ ...meetingParams, organizerIdentifier: 'some id/with#special?chars' });

      expect(fetchMock.mock.calls[1][0]).toContain(encodeURIComponent('some id/with#special?chars'));
    });

    it('falls back to joinUrl when joinWebUrl is absent', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(meetingResponse({ id: 'meeting-1', joinUrl: 'https://fallback' }));

      const result = await provider.createMeeting(meetingParams);
      expect(result).toEqual({ providerMeetingId: 'meeting-1', joinUrl: 'https://fallback' });
    });

    it('throws when a 200 response has no join URL at all, rather than returning an unusable result', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(meetingResponse({ id: 'meeting-1' }));

      await expect(provider.createMeeting(meetingParams)).rejects.toThrow(/returned no joinWebUrl/);
    });

    it('caches the resolved config/token setup across repeated calls (only re-fetches the token, not the config)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(meetingResponse({ id: 'meeting-1', joinWebUrl: 'https://x' }))
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce(meetingResponse({ id: 'meeting-2', joinWebUrl: 'https://y' }));

      await provider.createMeeting(meetingParams);
      await provider.createMeeting({ ...meetingParams, organizerIdentifier: 'john@example.com' });

      expect(integrations.getProvider).toHaveBeenCalledTimes(1);
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });

    it('surfaces a Graph error response (e.g. missing OnlineMeetings.ReadWrite.All grant) with a clear message', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Insufficient privileges to complete the operation.' } }),
      });

      await expect(provider.createMeeting(meetingParams)).rejects.toThrow(
        /Microsoft Graph create online meeting failed: HTTP 403 — Insufficient privileges/,
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

      await expect(provider.createMeeting(meetingParams)).rejects.toThrow(/HTTP 500 — unknown error/);
    });
  });

  describe('cancelMeeting', () => {
    it('DELETEs the meeting under the organizer', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

      await provider.cancelMeeting({ providerMeetingId: 'meeting-1', organizerIdentifier: 'jane@example.com' });

      const deleteCall = fetchMock.mock.calls[1];
      expect(deleteCall[0]).toBe('https://graph.microsoft.com/v1.0/users/jane%40example.com/onlineMeetings/meeting-1');
      expect(deleteCall[1].method).toBe('DELETE');
    });

    it('treats a 404 as success (already gone)', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

      await expect(
        provider.cancelMeeting({ providerMeetingId: 'meeting-1', organizerIdentifier: 'jane@example.com' }),
      ).resolves.toBeUndefined();
    });

    it('throws on other error statuses', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: 'Insufficient privileges to complete the operation.' } }),
      });

      await expect(provider.cancelMeeting({ providerMeetingId: 'meeting-1', organizerIdentifier: 'jane@example.com' })).rejects.toThrow(
        /Microsoft Graph cancel online meeting failed: HTTP 403 — Insufficient privileges/,
      );
    });
  });

  describe('resolveConfig', () => {
    it('throws when EMAIL_SMTP_PROVIDER_ID is not set', async () => {
      delete process.env.EMAIL_SMTP_PROVIDER_ID;
      await expect(provider.createMeeting(meetingParams)).rejects.toThrow('EMAIL_SMTP_PROVIDER_ID is not set');
    });

    it('throws when the referenced provider is not providerCode MS_GRAPH_EMAIL', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'SMTP' });
      await expect(provider.createMeeting(meetingParams)).rejects.toThrow('expected "MS_GRAPH_EMAIL"');
    });

    it('throws when the provider is not active', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.createMeeting(meetingParams)).rejects.toThrow('is not active');
    });

    it('throws listing missing config keys (tenantId/clientId only — senderUserId is not required here)', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: { senderUserId: 'x@example.com' } });
      await expect(provider.createMeeting(meetingParams)).rejects.toThrow('missing config.tenantId, config.clientId');
    });

    it('does not require senderUserId, unlike the Calendar/Tasks/Contacts providers', async () => {
      integrations.getProvider.mockResolvedValue({
        ...validProviderRow,
        config: { tenantId: 'tenant-1', clientId: 'client-1' }, // no senderUserId at all
      });
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce(meetingResponse({ id: 'meeting-1', joinWebUrl: 'https://x' }));

      await expect(provider.createMeeting(meetingParams)).resolves.toEqual({ providerMeetingId: 'meeting-1', joinUrl: 'https://x' });
    });

    it('throws when credentials.clientSecret is missing', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.createMeeting(meetingParams)).rejects.toThrow('missing credentials.clientSecret');
    });
  });
});
