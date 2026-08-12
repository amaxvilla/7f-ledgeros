import { Test } from '@nestjs/testing';
import { MicrosoftGraphCalendarProvider, MS_GRAPH_CALENDAR_PROVIDER_CODE } from '../providers/microsoft-graph-calendar.provider';
import { CalendarProviderRegistry } from '../calendar-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'graph-token-xyz', expires_in: 3600 }) };
}

describe('MicrosoftGraphCalendarProvider', () => {
  let provider: MicrosoftGraphCalendarProvider;
  let registry: CalendarProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

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
    registry = new CalendarProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        MicrosoftGraphCalendarProvider,
        { provide: IntegrationsService, useValue: integrations },
        { provide: CalendarProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(MicrosoftGraphCalendarProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into CalendarProviderRegistry under "MS_GRAPH"', () => {
      expect(registry.isRegistered(MS_GRAPH_CALENDAR_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(MS_GRAPH_CALENDAR_PROVIDER_CODE)).toBe(true);
      expect(registry.get(MS_GRAPH_CALENDAR_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('createEvent', () => {
    const params = {
      title: 'Site Visit — Unit A-3-12',
      description: 'Meet at the sales office',
      startTime: new Date('2026-08-01T10:00:00.000Z'),
      endTime: new Date('2026-08-01T10:30:00.000Z'),
      attendeeEmails: ['buyer@example.com'],
      location: 'Sales Office',
    };

    it('acquires a token then creates the event, mapping the Graph response', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'AAMk-event-1', webLink: 'https://outlook.office.com/event/1' }) });

      const result = await provider.createEvent(params);

      expect(result).toEqual({ providerEventId: 'AAMk-event-1', htmlLink: 'https://outlook.office.com/event/1' });

      const createCall = fetchMock.mock.calls[1];
      expect(createCall[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/events');
      expect(createCall[1].method).toBe('POST');
      const body = JSON.parse(createCall[1].body);
      expect(body).toEqual({
        subject: 'Site Visit — Unit A-3-12',
        body: { contentType: 'text', content: 'Meet at the sales office' },
        start: { dateTime: '2026-08-01T10:00:00.000Z', timeZone: 'UTC' },
        end: { dateTime: '2026-08-01T10:30:00.000Z', timeZone: 'UTC' },
        location: { displayName: 'Sales Office' },
        attendees: [{ emailAddress: { address: 'buyer@example.com' }, type: 'required' }],
      });
    });

    it('caches the resolved config across multiple calls (resolveConfig runs once)', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e1' }) })
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'e2' }) });

      await provider.createEvent(params);
      await provider.createEvent(params);

      expect(integrations.getProvider).toHaveBeenCalledTimes(1);
      expect(integrations.getDecryptedCredentials).toHaveBeenCalledTimes(1);
    });

    it('throws a clear error when Graph rejects the create request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient privileges' } }) });

      await expect(provider.createEvent(params)).rejects.toThrow('Insufficient privileges');
    });

    it('throws when EMAIL_SMTP_PROVIDER_ID is not set', async () => {
      delete process.env.EMAIL_SMTP_PROVIDER_ID;
      await expect(provider.createEvent(params)).rejects.toThrow('EMAIL_SMTP_PROVIDER_ID is not set');
    });

    it('throws when the configured provider is not providerCode MS_GRAPH_EMAIL', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'SMTP' });
      await expect(provider.createEvent(params)).rejects.toThrow('expected "MS_GRAPH_EMAIL"');
    });

    it('throws when the configured provider is inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.createEvent(params)).rejects.toThrow('is not active');
    });

    it('throws listing every missing config key at once', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: { tenantId: 'tenant-1' } });
      await expect(provider.createEvent(params)).rejects.toThrow(/config\.clientId.*config\.senderUserId/s);
    });

    it('throws when credentials.clientSecret is missing', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.createEvent(params)).rejects.toThrow('clientSecret');
    });
  });

  describe('updateEvent', () => {
    it('PATCHes only the fields provided', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.updateEvent({ providerEventId: 'AAMk-event-1', title: 'Rescheduled Site Visit' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/events/AAMk-event-1');
      expect(call[1].method).toBe('PATCH');
      expect(JSON.parse(call[1].body)).toEqual({ subject: 'Rescheduled Site Visit' });
    });

    it('throws a clear error when Graph rejects the update', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Event not found' } }) });

      await expect(provider.updateEvent({ providerEventId: 'missing', title: 'x' })).rejects.toThrow('Event not found');
    });
  });

  describe('cancelEvent', () => {
    it('POSTs to the /cancel endpoint with the comment', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.cancelEvent({ providerEventId: 'AAMk-event-1', comment: 'Customer rescheduled' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/events/AAMk-event-1/cancel');
      expect(call[1].method).toBe('POST');
      expect(JSON.parse(call[1].body)).toEqual({ comment: 'Customer rescheduled' });
    });

    it('defaults comment to an empty string when omitted', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.cancelEvent({ providerEventId: 'AAMk-event-1' });

      const call = fetchMock.mock.calls[1];
      expect(JSON.parse(call[1].body)).toEqual({ comment: '' });
    });

    it('throws a clear error when Graph rejects the cancel', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({ error: { message: 'Already cancelled' } }) });

      await expect(provider.cancelEvent({ providerEventId: 'AAMk-event-1' })).rejects.toThrow('Already cancelled');
    });
  });
});
