import { MicrosoftGraphMailService } from '../microsoft-graph-mail.service';

const fetchMock = jest.fn();

describe('MicrosoftGraphMailService', () => {
  let service: MicrosoftGraphMailService;
  const config = { tenantId: 't1', clientId: 'c1', clientSecret: 's1', senderUserId: 'sender@example.com' };

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    service = new MicrosoftGraphMailService();
  });

  it('acquires a token then POSTs a correctly-shaped sendMail payload', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) }) // token
      .mockResolvedValueOnce({ ok: true }); // sendMail (202, empty body)

    const result = await service.send(
      { to: ['a@example.com'], cc: ['b@example.com'], subject: 'Hi', html: '<p>Hello</p>' },
      config,
    );

    expect(result).toEqual({ delivered: true });
    const sendCall = fetchMock.mock.calls[1];
    expect(sendCall[0]).toBe('https://graph.microsoft.com/v1.0/users/sender%40example.com/sendMail');
    expect(sendCall[1].headers.Authorization).toBe('Bearer tok-1');
    const body = JSON.parse(sendCall[1].body);
    expect(body.message.subject).toBe('Hi');
    expect(body.message.body).toEqual({ contentType: 'HTML', content: '<p>Hello</p>' });
    expect(body.message.toRecipients).toEqual([{ emailAddress: { address: 'a@example.com' } }]);
    expect(body.message.ccRecipients).toEqual([{ emailAddress: { address: 'b@example.com' } }]);
  });

  it('uses plain-text content type when no html is given', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: true });

    await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'plain body' }, config);

    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.message.body).toEqual({ contentType: 'Text', content: 'plain body' });
  });

  it('throws with the Graph error body when sendMail is rejected', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) })
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' });

    await expect(service.send({ to: ['a@example.com'], subject: 'Hi', text: 'x' }, config)).rejects.toThrow('403');
  });

  it('reuses a cached token across sends instead of re-acquiring it every time', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok-1' }) }) // token (1st send only)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true });

    await service.send({ to: ['a@example.com'], subject: 'A', text: 'x' }, config);
    await service.send({ to: ['b@example.com'], subject: 'B', text: 'y' }, config);

    // 1 token call + 2 sendMail calls = 3 total, not 4.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
