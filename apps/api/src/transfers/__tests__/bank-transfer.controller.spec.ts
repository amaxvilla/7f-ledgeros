import { BankTransferController } from '../bank-transfer.controller';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('BankTransferController', () => {
  let controller: BankTransferController;
  let bankTransfers: { createRecord: jest.Mock; findRecords: jest.Mock; getRecord: jest.Mock; getByReference: jest.Mock; initiateTransfer: jest.Mock; verifyTransfer: jest.Mock };
  let securityContext: { buildScope: jest.Mock };
  const scope = { userId: 'user-1' } as any;
  const user = { id: 'user-1' } as AuthenticatedUser;

  const dto = {
    entityId: 'e1',
    providerCode: 'PAYSTACK',
    reference: 'txn-ref-001',
    amount: 50000,
    recipientAccountNumber: '0123456789',
    recipientBankCode: '044',
  };

  beforeEach(() => {
    bankTransfers = { createRecord: jest.fn(), findRecords: jest.fn(), getRecord: jest.fn(), getByReference: jest.fn(), initiateTransfer: jest.fn(), verifyTransfer: jest.fn() };
    securityContext = { buildScope: jest.fn().mockResolvedValue(scope) };
    controller = new BankTransferController(bankTransfers as any, securityContext as any);
  });

  it('create() delegates to the service with the caller as initiatedById', async () => {
    bankTransfers.createRecord.mockResolvedValue({ id: 'bt-1' });

    const result = await controller.create(dto as any, user);

    expect(bankTransfers.createRecord).toHaveBeenCalledWith(dto, 'user-1');
    expect(result).toEqual({ id: 'bt-1' });
  });

  it('findAll() builds scope from the caller and forwards filters to the service', async () => {
    bankTransfers.findRecords.mockResolvedValue([{ id: 'bt-1' }]);

    const result = await controller.findAll(user, 'e1', undefined, 'PAYSTACK');

    expect(securityContext.buildScope).toHaveBeenCalledWith(user);
    expect(bankTransfers.findRecords).toHaveBeenCalledWith(scope, { entityId: 'e1', status: undefined, providerCode: 'PAYSTACK' });
    expect(result).toEqual([{ id: 'bt-1' }]);
  });

  it('findOne() delegates to the service', async () => {
    bankTransfers.getRecord.mockResolvedValue({ id: 'bt-1' });
    const result = await controller.findOne('bt-1');
    expect(bankTransfers.getRecord).toHaveBeenCalledWith('bt-1');
    expect(result).toEqual({ id: 'bt-1' });
  });

  it('findByReference() delegates to the service', async () => {
    bankTransfers.getByReference.mockResolvedValue({ id: 'bt-1', reference: 'txn-ref-001' });
    const result = await controller.findByReference('txn-ref-001');
    expect(bankTransfers.getByReference).toHaveBeenCalledWith('txn-ref-001');
    expect(result).toEqual({ id: 'bt-1', reference: 'txn-ref-001' });
  });

  it('initiate() delegates to the service by id', async () => {
    bankTransfers.initiateTransfer.mockResolvedValue({ id: 'bt-1', status: 'SUCCESSFUL' });
    const result = await controller.initiate('bt-1');
    expect(bankTransfers.initiateTransfer).toHaveBeenCalledWith('bt-1');
    expect(result).toEqual({ id: 'bt-1', status: 'SUCCESSFUL' });
  });

  it('verify() delegates to the service by id (Checkpoint F)', async () => {
    bankTransfers.verifyTransfer.mockResolvedValue({ id: 'bt-1', status: 'SUCCESSFUL' });
    const result = await controller.verify('bt-1');
    expect(bankTransfers.verifyTransfer).toHaveBeenCalledWith('bt-1');
    expect(result).toEqual({ id: 'bt-1', status: 'SUCCESSFUL' });
  });

  it('does not expose an applyProviderResult route (checked by absence, not a route test)', () => {
    expect((controller as any).applyProviderResult).toBeUndefined();
  });
});
