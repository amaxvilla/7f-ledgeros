import { Test } from '@nestjs/testing';
import { GoogleCalendarProvider, GOOGLE_CALENDAR_PROVIDER_CODE } from '../providers/google-calendar.provider';
import { CalendarProviderRegistry } from '../calendar-provider.registry';
import { IntegrationsService } from '../../integrations/integrations.service';

const fetchMock = jest.fn();

function tokenResponse() {
  return { ok: true, json: async () => ({ access_token: 'google-token-xyz', expires_in: 3600 }) };
}

describe('GoogleCalendarProvider', () => {
  let provider: GoogleCalendarProvider;
  let registry: CalendarProviderRegistry;
  let integrations: { getProvider: jest.Mock; getDecryptedCredentials: jest.Mock };
  const originalEnv = process.env;

  const validProviderRow = {
    id: 'provider-1',
    providerCode: 'GMAIL_EMAIL',
    isActive: true,
    config: { clientId: 'client-1' },
  };

  beforeEach(async () => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    process.env = { ...originalEnv, EMAIL_SMTP_PROVIDER_ID: 'provider-1' };

    integrations = {
      getProvider: jest.fn().mockResolvedValue(validProviderRow),
      getDecryptedCredentials: jest.fn().mockResolvedValue({ clientSecret: 'shh', refreshToken: 'refresh-1' }),
    };
    registry = new CalendarProviderRegistry();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GoogleCalendarProvider,
        { provide: IntegrationsService, useValue: integrations },
        { provide: CalendarProviderRegistry, useValue: registry },
      ],
    }).compile();

    provider = moduleRef.get(GoogleCalendarProvider);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('onModuleInit', () => {
    it('registers itself into CalendarProviderRegistry under "GOOGLE_CALENDAR"', () => {
      expect(registry.isRegistered(GOOGLE_CALENDAR_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(GOOGLE_CALENDAR_PROVIDER_CODE)).toBe(true);
      expect(registry.get(GOOGLE_CALENDAR_PROVIDER_CODE)).toBe(provider);
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

    it('acquires a token then creates the event on the primary calendar, mapping the response', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'google-event-1', htmlLink: 'https://calendar.google.com/event?eid=1' }) });

      const result = await provider.createEvent(params);

      expect(result).toEqual({ providerEventId: 'google-event-1', htmlLink: 'https://calendar.google.com/event?eid=1' });

      const createCall = fetchMock.mock.calls[1];
      expect(createCall[0]).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all');
      expect(createCall[1].method).toBe('POST');
      const body = JSON.parse(createCall[1].body);
      expect(body).toEqual({
        summary: 'Site Visit — Unit A-3-12',
        description: 'Meet at the sales office',
        start: { dateTime: '2026-08-01T10:00:00.000Z', timeZone: 'UTC' },
        end: { dateTime: '2026-08-01T10:30:00.000Z', timeZone: 'UTC' },
        location: 'Sales Office',
        attendees: [{ email: 'buyer@example.com' }],
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

    it('throws a clear error when Google rejects the create request', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient Permission' } }) });

      await expect(provider.createEvent(params)).rejects.toThrow('Insufficient Permission');
    });

    it('throws when EMAIL_SMTP_PROVIDER_ID is not set', async () => {
      delete process.env.EMAIL_SMTP_PROVIDER_ID;
      await expect(provider.createEvent(params)).rejects.toThrow('EMAIL_SMTP_PROVIDER_ID is not set');
    });

    it('throws when the configured provider is not providerCode GMAIL_EMAIL', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, providerCode: 'SMTP' });
      await expect(provider.createEvent(params)).rejects.toThrow('expected "GMAIL_EMAIL"');
    });

    it('throws when the configured provider is inactive', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, isActive: false });
      await expect(provider.createEvent(params)).rejects.toThrow('is not active');
    });

    it('throws when config.clientId is missing', async () => {
      integrations.getProvider.mockResolvedValue({ ...validProviderRow, config: {} });
      await expect(provider.createEvent(params)).rejects.toThrow('config.clientId');
    });

    it('throws listing every missing credential at once', async () => {
      integrations.getDecryptedCredentials.mockResolvedValue({});
      await expect(provider.createEvent(params)).rejects.toThrow(/credentials\.clientSecret.*credentials\.refreshToken/s);
    });
  });

  describe('updateEvent', () => {
    it('PATCHes only the fields provided', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.updateEvent({ providerEventId: 'google-event-1', title: 'Rescheduled Site Visit' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events/google-event-1?sendUpdates=all');
      expect(call[1].method).toBe('PATCH');
      expect(JSON.parse(call[1].body)).toEqual({ summary: 'Rescheduled Site Visit' });
    });

    it('throws a clear error when Google rejects the update', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { message: 'Not Found' } }) });

      await expect(provider.updateEvent({ providerEventId: 'missing', title: 'x' })).rejects.toThrow('Not Found');
    });
  });

  describe('cancelEvent', () => {
    it('DELETEs the event with sendUpdates=all', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await provider.cancelEvent({ providerEventId: 'google-event-1', comment: 'Customer rescheduled' });

      const call = fetchMock.mock.calls[1];
      expect(call[0]).toBe('https://www.googleapis.com/calendar/v3/calendars/primary/events/google-event-1?sendUpdates=all');
      expect(call[1].method).toBe('DELETE');
    });

    it('treats a 410 Gone (already deleted) as success, not an error', async () => {
      fetchMock.mockResolvedValueOnce(tokenResponse()).mockResolvedValueOnce({ ok: false, status: 410, json: async () => ({ error: { message: 'Resource has been deleted' } }) });

      await expect(provider.cancelEvent({ providerEventId: 'google-event-1' })).resolves.toBeUndefined();
    });

    it('throws a clear error when Google rejects the cancel for any other reason', async () => {
      fetchMock
        .mockResolvedValueOnce(tokenResponse())
        .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Insufficient Permission' } }) });

      await expect(provider.cancelEvent({ providerEventId: 'google-event-1' })).rejects.toThrow('Insufficient Permission');
    });
  });
});
