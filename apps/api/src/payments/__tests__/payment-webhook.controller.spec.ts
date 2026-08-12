import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentWebhookController } from '../payment-webhook.controller';

function buildRequest(rawBody: Buffer | undefined, headers: Record<string, string> = {}) {
  return { rawBody, headers } as any;
}

describe('PaymentWebhookController', () => {
  let handlers: { isRegistered: jest.Mock; get: jest.Mock };
  let payments: { applyWebhookEvent: jest.Mock; applyRefundWebhookEvent: jest.Mock };
  let controller: PaymentWebhookController;

  beforeEach(() => {
    handlers = { isRegistered: jest.fn(), get: jest.fn() };
    payments = { applyWebhookEvent: jest.fn(), applyRefundWebhookEvent: jest.fn() };
    controller = new PaymentWebhookController(handlers as any, payments as any);
  });

  it('throws NotFoundException for an unregistered providerCode, without touching the handler or PaymentsService', async () => {
    handlers.isRegistered.mockReturnValue(false);

    await expect(controller.receive('STRIPE', buildRequest(Buffer.from('{}')))).rejects.toThrow(NotFoundException);

    expect(handlers.get).not.toHaveBeenCalled();
    expect(payments.applyWebhookEvent).not.toHaveBeenCalled();
    expect(payments.applyRefundWebhookEvent).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException and never applies the event when the signature is invalid', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const handler = { verifySignature: jest.fn().mockResolvedValue(false), parseEvent: jest.fn() };
    handlers.get.mockReturnValue(handler);

    await expect(controller.receive('PAYSTACK', buildRequest(Buffer.from('{}'), { 'x-paystack-signature': 'bad' }))).rejects.toThrow(
      ForbiddenException,
    );

    expect(handler.parseEvent).not.toHaveBeenCalled();
    expect(payments.applyWebhookEvent).not.toHaveBeenCalled();
    expect(payments.applyRefundWebhookEvent).not.toHaveBeenCalled();
  });

  it('parses and applies a charge-kind event via applyWebhookEvent', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const chargeEvent = { reference: 'ref-1', status: 'SUCCESSFUL' as const, raw: {} };
    const parsed = { kind: 'charge' as const, event: chargeEvent };
    const rawBody = Buffer.from(JSON.stringify({ reference: 'ref-1' }));
    const headers = { 'x-paystack-signature': 'good' };
    const handler = { verifySignature: jest.fn().mockResolvedValue(true), parseEvent: jest.fn().mockReturnValue(parsed) };
    handlers.get.mockReturnValue(handler);

    await controller.receive('PAYSTACK', buildRequest(rawBody, headers));

    expect(handler.verifySignature).toHaveBeenCalledWith(rawBody, headers);
    expect(handler.parseEvent).toHaveBeenCalledWith(rawBody);
    expect(payments.applyWebhookEvent).toHaveBeenCalledWith(chargeEvent);
    expect(payments.applyRefundWebhookEvent).not.toHaveBeenCalled();
  });

  it('parses and applies a refund-kind event via applyRefundWebhookEvent (Checkpoint E)', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const refundEvent = { refundReference: '4321', status: 'SUCCESSFUL' as const, raw: {} };
    const parsed = { kind: 'refund' as const, event: refundEvent };
    const rawBody = Buffer.from(JSON.stringify({ event: 'refund.processed' }));
    const headers = { 'x-paystack-signature': 'good' };
    const handler = { verifySignature: jest.fn().mockResolvedValue(true), parseEvent: jest.fn().mockReturnValue(parsed) };
    handlers.get.mockReturnValue(handler);

    await controller.receive('PAYSTACK', buildRequest(rawBody, headers));

    expect(payments.applyRefundWebhookEvent).toHaveBeenCalledWith(refundEvent);
    expect(payments.applyWebhookEvent).not.toHaveBeenCalled();
  });

  it('falls back to an empty buffer when req.rawBody is undefined', async () => {
    handlers.isRegistered.mockReturnValue(true);
    const handler = {
      verifySignature: jest.fn().mockResolvedValue(true),
      parseEvent: jest.fn().mockReturnValue({ kind: 'charge', event: { reference: 'r', status: 'PENDING', raw: {} } }),
    };
    handlers.get.mockReturnValue(handler);

    await controller.receive('PAYSTACK', buildRequest(undefined));

    expect(handler.verifySignature).toHaveBeenCalledWith(Buffer.from(''), {});
  });
});
