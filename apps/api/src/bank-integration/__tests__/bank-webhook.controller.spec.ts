import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BankWebhookController } from '../bank-webhook.controller';

function buildRequest(rawBody: Buffer | undefined, headers: Record<string, string> = {}) {
  return { rawBody, headers } as any;
}

describe('BankWebhookController', () => {
  let handlers: { isRegistered: jest.Mock; get: jest.Mock };
  let monoLinkedAccounts: { applyLinkStatusWebhookEvent: jest.Mock };
  let controller: BankWebhookController;

  beforeEach(() => {
    handlers = { isRegistered: jest.fn(), get: jest.fn() };
    monoLinkedAccounts = { applyLinkStatusWebhookEvent: jest.fn() };
    controller = new BankWebhookController(handlers as any, monoLinkedAccounts as any);
  });

  it('throws NotFoundException for an unregistered providerCode, without touching the handler or the service', async () => {
    handlers.isRegistered.mockReturnValue(false);

    await expect(controller.receive('OKRA', buildRequest(Buffer.from('{}')))).rejects.toThrow(NotFoundException);

    expect(handlers.get).not.toHaveBeenCalled();
    expect(monoLinkedAccounts.applyLinkStatusWebhookEvent).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException and never applies the event when the signature is invalid', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const handler = { verifySignature: jest.fn().mockResolvedValue(false), parseEvent: jest.fn() };
    handlers.get.mockReturnValue(handler);

    await expect(controller.receive('MONO', buildRequest(Buffer.from('{}'), { 'mono-webhook-secret': 'bad' }))).rejects.toThrow(
      ForbiddenException,
    );

    expect(handler.parseEvent).not.toHaveBeenCalled();
    expect(monoLinkedAccounts.applyLinkStatusWebhookEvent).not.toHaveBeenCalled();
  });

  it('parses and applies a link_status event via applyLinkStatusWebhookEvent', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const linkStatusEvent = { providerAccountId: 'acc_xyz789', status: 'REQUIRES_REAUTH' as const, raw: {} };
    const parsed = { kind: 'link_status' as const, event: linkStatusEvent };
    const rawBody = Buffer.from(JSON.stringify({ event: 'mono.events.reauthorisation_required' }));
    const headers = { 'mono-webhook-secret': 'whs_test_secret' };
    const handler = { verifySignature: jest.fn().mockResolvedValue(true), parseEvent: jest.fn().mockReturnValue(parsed) };
    handlers.get.mockReturnValue(handler);

    await controller.receive('MONO', buildRequest(rawBody, headers));

    expect(handler.verifySignature).toHaveBeenCalledWith(rawBody, headers);
    expect(handler.parseEvent).toHaveBeenCalledWith(rawBody);
    expect(monoLinkedAccounts.applyLinkStatusWebhookEvent).toHaveBeenCalledWith('acc_xyz789', 'REQUIRES_REAUTH');
  });

  it('does not call the service for an ignored-kind event', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const parsed = { kind: 'ignored' as const, eventType: 'mono.events.account_updated' };
    const handler = { verifySignature: jest.fn().mockResolvedValue(true), parseEvent: jest.fn().mockReturnValue(parsed) };
    handlers.get.mockReturnValue(handler);

    await controller.receive('MONO', buildRequest(Buffer.from('{}'), { 'mono-webhook-secret': 'whs_test_secret' }));

    expect(monoLinkedAccounts.applyLinkStatusWebhookEvent).not.toHaveBeenCalled();
  });

  it('does not call MonoLinkedAccountService for a providerCode other than MONO, even with a link_status result', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const parsed = { kind: 'link_status' as const, event: { providerAccountId: 'acc_1', status: 'ACTIVE' as const, raw: {} } };
    const handler = { verifySignature: jest.fn().mockResolvedValue(true), parseEvent: jest.fn().mockReturnValue(parsed) };
    handlers.get.mockReturnValue(handler);

    await controller.receive('OKRA', buildRequest(Buffer.from('{}'), { 'x-okra-signature': 'good' }));

    expect(monoLinkedAccounts.applyLinkStatusWebhookEvent).not.toHaveBeenCalled();
  });

  it('falls back to an empty buffer when req.rawBody is undefined', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const handler = {
      verifySignature: jest.fn().mockResolvedValue(true),
      parseEvent: jest.fn().mockReturnValue({ kind: 'ignored', eventType: 'mono.events.account_updated' }),
    };
    handlers.get.mockReturnValue(handler);

    await controller.receive('MONO', buildRequest(undefined));

    expect(handler.verifySignature).toHaveBeenCalledWith(Buffer.from(''), {});
  });
});
