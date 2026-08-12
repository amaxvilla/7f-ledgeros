import { BadRequestException } from '@nestjs/common';
import { MonoLinkedAccountController } from '../mono-linked-account.controller';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

describe('MonoLinkedAccountController', () => {
  let controller: MonoLinkedAccountController;
  let monoLinkedAccounts: { link: jest.Mock; findByBankAccount: jest.Mock; revoke: jest.Mock; getBalance: jest.Mock; importStatement: jest.Mock };
  let securityContext: { buildScope: jest.Mock };
  const scope = { userId: 'user-1' } as any;
  const user = { id: 'user-1' } as AuthenticatedUser;

  beforeEach(() => {
    monoLinkedAccounts = {
      link: jest.fn(),
      findByBankAccount: jest.fn(),
      revoke: jest.fn(),
      getBalance: jest.fn(),
      importStatement: jest.fn(),
    };
    securityContext = { buildScope: jest.fn().mockResolvedValue(scope) };
    controller = new MonoLinkedAccountController(monoLinkedAccounts as any, securityContext as any);
  });

  it('link() builds scope from the caller and delegates to the service', async () => {
    monoLinkedAccounts.link.mockResolvedValue({ id: 'link-1' });
    const dto = { code: 'connect-code', bankAccountId: 'bank-1' };

    const result = await controller.link(dto, user);

    expect(securityContext.buildScope).toHaveBeenCalledWith(user);
    expect(monoLinkedAccounts.link).toHaveBeenCalledWith(dto, 'user-1', scope);
    expect(result).toEqual({ id: 'link-1' });
  });

  it('findByBankAccount() requires the bankAccountId query param', async () => {
    await expect(controller.findByBankAccount(undefined, user)).rejects.toThrow(BadRequestException);
    expect(monoLinkedAccounts.findByBankAccount).not.toHaveBeenCalled();
  });

  it('findByBankAccount() delegates to the service with the built scope', async () => {
    monoLinkedAccounts.findByBankAccount.mockResolvedValue([{ id: 'link-1' }]);
    const result = await controller.findByBankAccount('bank-1', user);
    expect(monoLinkedAccounts.findByBankAccount).toHaveBeenCalledWith('bank-1', scope);
    expect(result).toEqual([{ id: 'link-1' }]);
  });

  it('revoke() delegates to the service with the built scope', async () => {
    monoLinkedAccounts.revoke.mockResolvedValue({ id: 'link-1', status: 'REVOKED' });
    const result = await controller.revoke('link-1', user);
    expect(monoLinkedAccounts.revoke).toHaveBeenCalledWith('link-1', scope);
    expect(result).toEqual({ id: 'link-1', status: 'REVOKED' });
  });

  it('getBalance() delegates to the service with the built scope (Checkpoint E)', async () => {
    monoLinkedAccounts.getBalance.mockResolvedValue({ balance: 50000, currency: 'NGN' });
    const result = await controller.getBalance('link-1', user);
    expect(securityContext.buildScope).toHaveBeenCalledWith(user);
    expect(monoLinkedAccounts.getBalance).toHaveBeenCalledWith('link-1', scope);
    expect(result).toEqual({ balance: 50000, currency: 'NGN' });
  });

  it('importStatement() delegates to the service with the built scope and caller id (Checkpoint E)', async () => {
    monoLinkedAccounts.importStatement.mockResolvedValue({ id: 'stmt-1' });
    const dto = { fromDate: '2026-07-01', toDate: '2026-07-31' };

    const result = await controller.importStatement('link-1', dto, user);

    expect(monoLinkedAccounts.importStatement).toHaveBeenCalledWith('link-1', '2026-07-01', '2026-07-31', 'user-1', scope);
    expect(result).toEqual({ id: 'stmt-1' });
  });
});
