import { GmailMailService } from '../gmail-mail.service';

const fetchMock = jest.fn();

describe('GmailMailService', () => {
  let service: GmailMailService;
  const config = { clientId: 'c1', clientSecret: 's1', refreshToken: 'r1' };

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    service = new GmailMailService();
  });

  it('acquires a token then POSTs a base64url-encoded raw MIME message', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) }) // token
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'msg-1' }) }); // messages.send

    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', html: '<p>Hello</p>' }, config);

    expect(result).toEqual({ delivered: true, messageId: 'msg-1' });
    const tokenCall = fetchMock.mock.calls[0];
    expect(tokenCall[0]).toBe('https://oauth2.googleapis.com/token');

    const sendCall = fetchMock.mock.calls[1];
    expect(sendCall[0]).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
    expect(sendCall[1].headers.Authorization).toBe('Bearer tok-1');
    const body = JSON.parse(sendCall[1].body);
    expect(typeof body.raw).toBe('string');
    // base64url must not contain '+', '/' or padding '='.
    expect(body.raw).not.toMatch(/[+/=]/);
  });

  it('throws with the Gmail error body when messages.send is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' });

    await expect(service.send({ to: ['a@example.com'], subject: 'Hi', text: 'x' }, config)).rejects.toThrow('403');
  });

  it('reuses a cached token across sends instead of re-acquiring it every time', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) }) // token (1st send only)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'm1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'm2' }) });

    await service.send({ to: ['a@example.com'], subject: 'A', text: 'x' }, config);
    await service.send({ to: ['b@example.com'], subject: 'B', text: 'y' }, config);

    // 1 token call + 2 messages.send calls = 3 total, not 4.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
