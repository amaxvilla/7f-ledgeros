import { MailService } from '../mail.service';
import { encryptIntegrationCredentials } from '@7f/config';

const sendMailMock = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn().mockImplementation(() => ({ sendMail: sendMailMock })),
  },
}));

describe('MailService (Release IC.1 — SMTP wiring)', () => {
  let prisma: { integrationProvider: { findUnique: jest.Mock } };
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sendMailMock.mockReset().mockResolvedValue({ messageId: 'msg-1' });
    prisma = { integrationProvider: { findUnique: jest.fn() } };
    process.env = { ...originalEnv };
    delete process.env.EMAIL_SMTP_PROVIDER_ID;
    delete process.env.SMTP_HOST;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('logs a no-op and reports undelivered when nothing is configured (zero-config dev path, unchanged)', async () => {
    const service = new MailService(prisma as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });
    expect(result).toEqual({ delivered: false });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('falls back to raw SMTP_* env vars when EMAIL_SMTP_PROVIDER_ID is not set', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '2525';
    process.env.SMTP_USER = 'legacyuser';
    process.env.SMTP_PASSWORD = 'legacypass';

    const service = new MailService(prisma as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });

    expect(result.delivered).toBe(true);
    expect(prisma.integrationProvider.findUnique).not.toHaveBeenCalled();
  });

  it('resolves config/credentials from the IntegrationProvider row when EMAIL_SMTP_PROVIDER_ID is set', async () => {
    process.env.EMAIL_SMTP_PROVIDER_ID = 'prov-1';
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-1',
      isActive: true,
      config: { host: 'smtp.sendgrid.net', port: 587, secure: false, fromAddress: 'no-reply@example.com' },
      encryptedCredentials: encryptIntegrationCredentials({ user: 'apikey', password: 's3cr3t' }),
    });

    const service = new MailService(prisma as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });

    expect(result.delivered).toBe(true);
    expect(prisma.integrationProvider.findUnique).toHaveBeenCalledWith({ where: { id: 'prov-1' } });
    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'no-reply@example.com' }));
  });

  it('falls back to env vars when the configured provider row is inactive', async () => {
    process.env.EMAIL_SMTP_PROVIDER_ID = 'prov-1';
    process.env.SMTP_HOST = 'fallback.example.com';
    prisma.integrationProvider.findUnique.mockResolvedValue({ id: 'prov-1', isActive: false, config: {}, encryptedCredentials: null });

    const service = new MailService(prisma as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });

    expect(result.delivered).toBe(true);
  });

  it('falls back to env vars when the configured provider row does not exist', async () => {
    process.env.EMAIL_SMTP_PROVIDER_ID = 'missing-id';
    process.env.SMTP_HOST = 'fallback.example.com';
    prisma.integrationProvider.findUnique.mockResolvedValue(null);

    const service = new MailService(prisma as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });

    expect(result.delivered).toBe(true);
  });

  it('only resolves config once across multiple sends (transporter is cached)', async () => {
    process.env.EMAIL_SMTP_PROVIDER_ID = 'prov-1';
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-1',
      isActive: true,
      config: { host: 'smtp.sendgrid.net' },
      encryptedCredentials: null,
    });

    const service = new MailService(prisma as any);
    await service.send({ to: ['a@example.com'], subject: 'One', text: 'x' });
    await service.send({ to: ['b@example.com'], subject: 'Two', text: 'y' });

    expect(prisma.integrationProvider.findUnique).toHaveBeenCalledTimes(1);
  });

  it('Release IC.2: delegates to MicrosoftGraphMailService when the resolved provider is MS_GRAPH_EMAIL, and never touches nodemailer', async () => {
    process.env.EMAIL_SMTP_PROVIDER_ID = 'prov-graph';
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-graph',
      isActive: true,
      providerCode: 'MS_GRAPH_EMAIL',
      config: { tenantId: 't1', clientId: 'c1', senderUserId: 'sender@example.com' },
      encryptedCredentials: encryptIntegrationCredentials({ clientSecret: 'shh' }),
    });
    const graphMail = { send: jest.fn().mockResolvedValue({ delivered: true }) };

    const service = new MailService(prisma as any, graphMail as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });

    expect(result).toEqual({ delivered: true });
    expect(graphMail.send).toHaveBeenCalledWith(
      { to: ['a@example.com'], subject: 'Hi', text: 'body' },
      { tenantId: 't1', clientId: 'c1', clientSecret: 'shh', senderUserId: 'sender@example.com' },
    );
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('Release IC.2: falls back to the SMTP path when graphMail is not injected, even for an MS_GRAPH_EMAIL provider row', async () => {
    process.env.EMAIL_SMTP_PROVIDER_ID = 'prov-graph';
    process.env.SMTP_HOST = 'fallback.example.com';
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-graph',
      isActive: true,
      providerCode: 'MS_GRAPH_EMAIL',
      config: { tenantId: 't1', clientId: 'c1', senderUserId: 'sender@example.com' },
      encryptedCredentials: null,
    });

    // No second constructor arg — mirrors every pre-Release-IC.2 call site.
    const service = new MailService(prisma as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });

    expect(result.delivered).toBe(true);
    expect(sendMailMock).toHaveBeenCalled();
  });

  it('Release IC.3: delegates to GmailMailService when the resolved provider is GMAIL_EMAIL, and never touches nodemailer or MicrosoftGraphMailService', async () => {
    process.env.EMAIL_SMTP_PROVIDER_ID = 'prov-gmail';
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-gmail',
      isActive: true,
      providerCode: 'GMAIL_EMAIL',
      config: { clientId: 'c1' },
      encryptedCredentials: encryptIntegrationCredentials({ clientSecret: 'shh', refreshToken: 'r1' }),
    });
    const graphMail = { send: jest.fn() };
    const gmail = { send: jest.fn().mockResolvedValue({ delivered: true, messageId: 'm1' }) };

    const service = new MailService(prisma as any, graphMail as any, gmail as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });

    expect(result).toEqual({ delivered: true, messageId: 'm1' });
    expect(gmail.send).toHaveBeenCalledWith(
      { to: ['a@example.com'], subject: 'Hi', text: 'body' },
      { clientId: 'c1', clientSecret: 'shh', refreshToken: 'r1' },
    );
    expect(graphMail.send).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('Release IC.3: falls back to the SMTP path when gmail is not injected, even for a GMAIL_EMAIL provider row', async () => {
    process.env.EMAIL_SMTP_PROVIDER_ID = 'prov-gmail';
    process.env.SMTP_HOST = 'fallback.example.com';
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-gmail',
      isActive: true,
      providerCode: 'GMAIL_EMAIL',
      config: { clientId: 'c1' },
      encryptedCredentials: null,
    });

    // No third constructor arg — mirrors every pre-Release-IC.3 call site.
    const service = new MailService(prisma as any);
    const result = await service.send({ to: ['a@example.com'], subject: 'Hi', text: 'body' });

    expect(result.delivered).toBe(true);
    expect(sendMailMock).toHaveBeenCalled();
  });
});
