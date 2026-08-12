import { Test } from '@nestjs/testing';
import { PaymentsController } from '../payments.controller';
import { PaymentsService } from '../payments.service';
import { SecurityContextService } from '../../security/security-context.service';

/**
 * Release IE.1, Checkpoint I — Tests.
 *
 * Every other piece of the Payment Framework (PaymentsService,
 * PaymentProviderRegistry, PaymentWebhookHandlerRegistry,
 * PaymentWebhookController, PaymentReconciliationProcessor) already had
 * real test coverage from its own checkpoint. This was the one gap:
 * PaymentsController itself — the initialize/verify/refund/list HTTP
 * layer — had no test file at all. These are deliberately thin
 * delegation tests (build scope, call the right PaymentsService method
 * with the right args) since PaymentsService's own business logic is
 * already covered in payments.service.spec.ts; duplicating that here
 * would just be redundant, not more thorough.
 */
describe('PaymentsController', () => {
  let controller: PaymentsController;
  let payments: {
    initializePayment: jest.Mock;
    verifyPayment: jest.Mock;
    refundPayment: jest.Mock;
    verifyRefund: jest.Mock;
    findTransaction: jest.Mock;
    listTransactions: jest.Mock;
  };
  let securityContext: { buildScope: jest.Mock };

  const user = { id: 'user-1', email: 'a@b.com' } as any;
  const scope = { userId: 'user-1', isSystemAdmin: true } as any;

  beforeEach(async () => {
    payments = {
      initializePayment: jest.fn(),
      verifyPayment: jest.fn(),
      refundPayment: jest.fn(),
      verifyRefund: jest.fn(),
      findTransaction: jest.fn(),
      listTransactions: jest.fn(),
    };
    securityContext = { buildScope: jest.fn().mockResolvedValue(scope) };

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: payments },
        { provide: SecurityContextService, useValue: securityContext },
      ],
    }).compile();

    controller = moduleRef.get(PaymentsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('initialize() builds scope from the current user and delegates to PaymentsService.initializePayment', async () => {
    const dto = { entityId: 'ent-1', reference: 'ref-1', amount: 5000, currency: 'NGN', customerEmail: 'c@x.com', providerCode: 'PAYSTACK' } as any;
    payments.initializePayment.mockResolvedValue({ reference: 'ref-1' });

    const result = await controller.initialize(user, dto);

    expect(securityContext.buildScope).toHaveBeenCalledWith(user);
    expect(payments.initializePayment).toHaveBeenCalledWith(scope, dto, user.id);
    expect(result).toEqual({ reference: 'ref-1' });
  });

  it('verify() delegates to PaymentsService.verifyPayment with the reference param', async () => {
    payments.verifyPayment.mockResolvedValue({ status: 'SUCCESSFUL' });

    const result = await controller.verify(user, 'ref-1');

    expect(payments.verifyPayment).toHaveBeenCalledWith(scope, 'ref-1', user.id);
    expect(result).toEqual({ status: 'SUCCESSFUL' });
  });

  it('refund() delegates to PaymentsService.refundPayment with the reference param and body', async () => {
    const dto = { amount: 1000, reason: 'customer request' } as any;
    payments.refundPayment.mockResolvedValue({ status: 'PENDING' });

    const result = await controller.refund(user, 'ref-1', dto);

    expect(payments.refundPayment).toHaveBeenCalledWith(scope, 'ref-1', dto, user.id);
    expect(result).toEqual({ status: 'PENDING' });
  });

  it('verifyRefund() delegates to PaymentsService.verifyRefund with the refundReference param (Checkpoint G)', async () => {
    payments.verifyRefund.mockResolvedValue({ status: 'SUCCESSFUL' });

    const result = await controller.verifyRefund(user, 'refund-1');

    expect(payments.verifyRefund).toHaveBeenCalledWith(scope, 'refund-1', user.id);
    expect(result).toEqual({ status: 'SUCCESSFUL' });
  });

  it('findOne() delegates to PaymentsService.findTransaction', async () => {
    payments.findTransaction.mockResolvedValue({ reference: 'ref-1' });

    const result = await controller.findOne(user, 'ref-1');

    expect(payments.findTransaction).toHaveBeenCalledWith(scope, 'ref-1');
    expect(result).toEqual({ reference: 'ref-1' });
  });

  it('findAll() passes entityId plus the optional status/providerCode filters through as one object', async () => {
    payments.listTransactions.mockResolvedValue([]);

    await controller.findAll(user, 'ent-1', 'SUCCESSFUL' as any, 'PAYSTACK');

    expect(payments.listTransactions).toHaveBeenCalledWith(scope, 'ent-1', { status: 'SUCCESSFUL', providerCode: 'PAYSTACK' });
  });

  it('findAll() works with no status/providerCode filters supplied', async () => {
    payments.listTransactions.mockResolvedValue([]);

    await controller.findAll(user, 'ent-1');

    expect(payments.listTransactions).toHaveBeenCalledWith(scope, 'ent-1', { status: undefined, providerCode: undefined });
  });
});
