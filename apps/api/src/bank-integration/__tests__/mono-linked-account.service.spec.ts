import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MonoLinkStatus } from '@prisma/client';
import { MonoLinkedAccountService } from '../mono-linked-account.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { SecurityScope } from '../../security/security.types';

function buildUnrestrictedScope(): SecurityScope {
  const unrestricted = { unrestricted: true, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-1',
    isSystemAdmin: true,
    entity: unrestricted,
    department: unrestricted,
    costCenter: unrestricted,
    project: unrestricted,
    businessUnit: unrestricted,
  };
}

function buildRestrictedScope(allowedEntityIds: string[]): SecurityScope {
  const restricted = { unrestricted: false, viewableIds: allowedEntityIds, postableIds: allowedEntityIds };
  const none = { unrestricted: false, viewableIds: [], postableIds: [] };
  return {
    userId: 'user-2',
    isSystemAdmin: false,
    entity: restricted,
    department: none,
    costCenter: none,
    project: none,
    businessUnit: restricted,
  };
}

describe('MonoLinkedAccountService', () => {
  let service: MonoLinkedAccountService;
  let prisma: {
    bankAccount: { findUnique: jest.Mock };
    monoLinkedAccount: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let monoProvider: { exchangeConnectCode: jest.Mock; fetchAccountMeta: jest.Mock; fetchBalance: jest.Mock; fetchStatement: jest.Mock };
  let bankReconciliation: { importStatement: jest.Mock };
  const rowLevelSecurity = new RowLevelSecurityService();

  const bankAccount = { id: 'bank-1', entityId: 'entity-1', accountName: 'Main', accountNumber: '0123456789' };

  beforeEach(() => {
    prisma = {
      bankAccount: { findUnique: jest.fn().mockResolvedValue(bankAccount) },
      monoLinkedAccount: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    monoProvider = {
      exchangeConnectCode: jest.fn().mockResolvedValue({ monoAccountId: 'acc_xyz789' }),
      fetchAccountMeta: jest.fn().mockResolvedValue({ institutionName: 'GTBank', accountNumberMasked: '****6789', currency: 'NGN' }),
      fetchBalance: jest.fn(),
      fetchStatement: jest.fn(),
    };
    bankReconciliation = { importStatement: jest.fn() };

    service = new MonoLinkedAccountService(prisma as any, rowLevelSecurity, monoProvider as any, bankReconciliation as any);
  });

  describe('link', () => {
    it('exchanges the code, fetches display metadata, and creates a linked account row', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(null);
      prisma.monoLinkedAccount.create.mockImplementation(({ data }) => Promise.resolve({ id: 'link-1', status: MonoLinkStatus.ACTIVE, ...data }));

      const result = await service.link({ code: 'connect-code', bankAccountId: 'bank-1' }, 'user-1', buildUnrestrictedScope());

      expect(monoProvider.exchangeConnectCode).toHaveBeenCalledWith('connect-code');
      expect(prisma.monoLinkedAccount.create).toHaveBeenCalledWith({
        data: {
          bankAccountId: 'bank-1',
          monoAccountId: 'acc_xyz789',
          institutionName: 'GTBank',
          accountNumberMasked: '****6789',
          currency: 'NGN',
          linkedById: 'user-1',
        },
      });
      expect(result).toMatchObject({ monoAccountId: 'acc_xyz789' });
    });

    it('throws NotFoundException when the bank account does not exist', async () => {
      prisma.bankAccount.findUnique.mockResolvedValue(null);
      await expect(service.link({ code: 'c', bankAccountId: 'missing' }, 'user-1', buildUnrestrictedScope())).rejects.toThrow(NotFoundException);
      expect(monoProvider.exchangeConnectCode).not.toHaveBeenCalled();
    });

    it('throws NotFoundException (not Forbidden) when the caller has no RLS grant on the bank account entity', async () => {
      const scope = buildRestrictedScope(['some-other-entity']);
      await expect(service.link({ code: 'c', bankAccountId: 'bank-1' }, 'user-2', scope)).rejects.toThrow(NotFoundException);
      expect(monoProvider.exchangeConnectCode).not.toHaveBeenCalled();
    });

    it('succeeds when the caller has an RLS grant on the bank account entity', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(null);
      prisma.monoLinkedAccount.create.mockImplementation(({ data }) => Promise.resolve({ id: 'link-1', ...data }));
      const scope = buildRestrictedScope(['entity-1']);

      await expect(service.link({ code: 'c', bankAccountId: 'bank-1' }, 'user-2', scope)).resolves.toBeDefined();
    });

    it('throws ConflictException when the Mono account is already linked elsewhere', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue({ id: 'existing-link' });
      await expect(service.link({ code: 'c', bankAccountId: 'bank-1' }, 'user-1', buildUnrestrictedScope())).rejects.toThrow(ConflictException);
      expect(prisma.monoLinkedAccount.create).not.toHaveBeenCalled();
    });

    it('still creates the link when fetchAccountMeta fails (best-effort metadata)', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(null);
      monoProvider.fetchAccountMeta.mockRejectedValue(new Error('Mono account lookup failed: HTTP 500'));
      prisma.monoLinkedAccount.create.mockImplementation(({ data }) => Promise.resolve({ id: 'link-1', ...data }));

      const result = await service.link({ code: 'c', bankAccountId: 'bank-1' }, 'user-1', buildUnrestrictedScope());

      expect(result).toMatchObject({ monoAccountId: 'acc_xyz789' });
      expect(prisma.monoLinkedAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ institutionName: undefined, accountNumberMasked: undefined, currency: undefined }),
      });
    });
  });

  describe('findByBankAccount', () => {
    it('lists linked accounts for a bank account the caller can view', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([{ id: 'link-1' }]);
      const result = await service.findByBankAccount('bank-1', buildUnrestrictedScope());
      expect(result).toEqual([{ id: 'link-1' }]);
      expect(prisma.monoLinkedAccount.findMany).toHaveBeenCalledWith({ where: { bankAccountId: 'bank-1' }, orderBy: { linkedAt: 'desc' } });
    });

    it('throws NotFoundException when the caller has no RLS grant', async () => {
      await expect(service.findByBankAccount('bank-1', buildRestrictedScope(['other']))).rejects.toThrow(NotFoundException);
    });
  });

  describe('revoke', () => {
    const linkedRow = { id: 'link-1', status: MonoLinkStatus.ACTIVE, bankAccount };

    it('marks an active link REVOKED with a timestamp', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(linkedRow);
      prisma.monoLinkedAccount.update.mockResolvedValue({ ...linkedRow, status: MonoLinkStatus.REVOKED, revokedAt: new Date() });

      await service.revoke('link-1', buildUnrestrictedScope());

      expect(prisma.monoLinkedAccount.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { status: MonoLinkStatus.REVOKED, revokedAt: expect.any(Date) },
      });
    });

    it('is idempotent — revoking an already-revoked link does not error or re-update', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue({ ...linkedRow, status: MonoLinkStatus.REVOKED });

      const result = await service.revoke('link-1', buildUnrestrictedScope());

      expect(result.status).toBe(MonoLinkStatus.REVOKED);
      expect(prisma.monoLinkedAccount.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the link does not exist', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(null);
      await expect(service.revoke('missing', buildUnrestrictedScope())).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the caller has no RLS grant on the linked bank account entity', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(linkedRow);
      await expect(service.revoke('link-1', buildRestrictedScope(['other']))).rejects.toThrow(NotFoundException);
    });
  });

  describe('getBalance (Checkpoint E)', () => {
    const linkedRow = { id: 'link-1', status: MonoLinkStatus.ACTIVE, bankAccountId: 'bank-1', bankAccount };

    it('delegates to MonoProvider.fetchBalance for the linked account\'s BankAccount', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(linkedRow);
      monoProvider.fetchBalance.mockResolvedValue({ balance: 125000.5, currency: 'NGN', asOf: new Date() });

      const result = await service.getBalance('link-1', buildUnrestrictedScope());

      expect(monoProvider.fetchBalance).toHaveBeenCalledWith({ accountNumber: bankAccount.accountNumber, bankCode: '' });
      expect(result.balance).toBe(125000.5);
    });

    it('throws NotFoundException for an unknown linked account', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(null);
      await expect(service.getBalance('missing', buildUnrestrictedScope())).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the caller has no RLS grant on the entity', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(linkedRow);
      await expect(service.getBalance('link-1', buildRestrictedScope(['other']))).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException for a REVOKED linked account', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue({ ...linkedRow, status: MonoLinkStatus.REVOKED });
      await expect(service.getBalance('link-1', buildUnrestrictedScope())).rejects.toThrow(ConflictException);
    });
  });

  describe('importStatement (Checkpoint E)', () => {
    const linkedRow = { id: 'link-1', status: MonoLinkStatus.ACTIVE, bankAccountId: 'bank-1', bankAccount };

    it('composes fetchStatement + fetchBalance into ImportBankStatementDto and delegates to BankReconciliationService', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(linkedRow);
      monoProvider.fetchStatement.mockResolvedValue([
        { transactionDate: new Date('2026-07-05'), description: 'POS purchase', reference: 'ref-1', amount: -5000 },
        { transactionDate: new Date('2026-07-10'), description: 'Transfer in', reference: 'ref-2', amount: 20000 },
      ]);
      monoProvider.fetchBalance.mockResolvedValue({ balance: 115000, currency: 'NGN', asOf: new Date() });
      bankReconciliation.importStatement.mockResolvedValue({ id: 'stmt-1' });

      const result = await service.importStatement('link-1', '2026-07-01', '2026-07-31', 'user-1', buildUnrestrictedScope());

      expect(bankReconciliation.importStatement).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: bankAccount.entityId,
          bankAccountId: 'bank-1',
          periodStart: '2026-07-01',
          periodEnd: '2026-07-31',
          closingBalance: 115000,
          openingBalance: 100000, // 115000 - (-5000 + 20000)
          lines: [
            expect.objectContaining({ description: 'POS purchase', amount: -5000 }),
            expect.objectContaining({ description: 'Transfer in', amount: 20000 }),
          ],
        }),
        'user-1',
      );
      expect(result).toEqual({ id: 'stmt-1' });
    });

    it('throws ConflictException when Mono reports no transactions in range, without calling BankReconciliationService', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(linkedRow);
      monoProvider.fetchStatement.mockResolvedValue([]);
      monoProvider.fetchBalance.mockResolvedValue({ balance: 100000, currency: 'NGN', asOf: new Date() });

      await expect(
        service.importStatement('link-1', '2026-07-01', '2026-07-31', 'user-1', buildUnrestrictedScope()),
      ).rejects.toThrow(ConflictException);
      expect(bankReconciliation.importStatement).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown linked account', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(null);
      await expect(
        service.importStatement('missing', '2026-07-01', '2026-07-31', 'user-1', buildUnrestrictedScope()),
      ).rejects.toThrow(NotFoundException);
      expect(bankReconciliation.importStatement).not.toHaveBeenCalled();
    });

    it('throws ConflictException for a REVOKED linked account, without calling BankReconciliationService', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue({ ...linkedRow, status: MonoLinkStatus.REVOKED });
      await expect(
        service.importStatement('link-1', '2026-07-01', '2026-07-31', 'user-1', buildUnrestrictedScope()),
      ).rejects.toThrow(ConflictException);
      expect(bankReconciliation.importStatement).not.toHaveBeenCalled();
    });
  });

  describe('applyLinkStatusWebhookEvent (Checkpoint G)', () => {
    it('sets status to REQUIRES_REAUTH and stamps reauthRequiredAt', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue({ monoAccountId: 'acc_xyz789', status: MonoLinkStatus.ACTIVE });
      prisma.monoLinkedAccount.update.mockResolvedValue({ monoAccountId: 'acc_xyz789', status: MonoLinkStatus.REQUIRES_REAUTH });

      await service.applyLinkStatusWebhookEvent('acc_xyz789', 'REQUIRES_REAUTH');

      expect(prisma.monoLinkedAccount.update).toHaveBeenCalledWith({
        where: { monoAccountId: 'acc_xyz789' },
        data: { status: MonoLinkStatus.REQUIRES_REAUTH, reauthRequiredAt: expect.any(Date) },
      });
    });

    it('sets status back to ACTIVE and clears reauthRequiredAt on reauthorisation', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue({ monoAccountId: 'acc_xyz789', status: MonoLinkStatus.REQUIRES_REAUTH });
      prisma.monoLinkedAccount.update.mockResolvedValue({ monoAccountId: 'acc_xyz789', status: MonoLinkStatus.ACTIVE });

      await service.applyLinkStatusWebhookEvent('acc_xyz789', 'ACTIVE');

      expect(prisma.monoLinkedAccount.update).toHaveBeenCalledWith({
        where: { monoAccountId: 'acc_xyz789' },
        data: { status: MonoLinkStatus.ACTIVE, reauthRequiredAt: null },
      });
    });

    it('no-ops (returns null) without calling update when no MonoLinkedAccount matches the monoAccountId', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(null);

      const result = await service.applyLinkStatusWebhookEvent('acc_unknown', 'REQUIRES_REAUTH');

      expect(result).toBeNull();
      expect(prisma.monoLinkedAccount.update).not.toHaveBeenCalled();
    });

    it('ignores the event (does not resurrect the link) when the matching account is REVOKED', async () => {
      const revoked = { monoAccountId: 'acc_xyz789', status: MonoLinkStatus.REVOKED };
      prisma.monoLinkedAccount.findUnique.mockResolvedValue(revoked);

      const result = await service.applyLinkStatusWebhookEvent('acc_xyz789', 'ACTIVE');

      expect(result).toBe(revoked);
      expect(prisma.monoLinkedAccount.update).not.toHaveBeenCalled();
    });

    it('is idempotent — applying the same status twice only ever updates, never throws', async () => {
      prisma.monoLinkedAccount.findUnique.mockResolvedValue({ monoAccountId: 'acc_xyz789', status: MonoLinkStatus.REQUIRES_REAUTH });
      prisma.monoLinkedAccount.update.mockResolvedValue({ monoAccountId: 'acc_xyz789', status: MonoLinkStatus.REQUIRES_REAUTH });

      await service.applyLinkStatusWebhookEvent('acc_xyz789', 'REQUIRES_REAUTH');
      await service.applyLinkStatusWebhookEvent('acc_xyz789', 'REQUIRES_REAUTH');

      expect(prisma.monoLinkedAccount.update).toHaveBeenCalledTimes(2);
    });
  });

  describe('getOverview (Release IF.1, Checkpoint I)', () => {
    const NOW = new Date('2026-07-30T12:00:00.000Z');

    beforeEach(() => {
      jest.useFakeTimers({ now: NOW });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects for an entity outside the caller\'s scope', async () => {
      await expect(service.getOverview(buildRestrictedScope(['entity-9']), 'entity-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.monoLinkedAccount.findMany).not.toHaveBeenCalled();
    });

    it('counts accounts by status and lists which need reauth', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([
        { id: 'acc-1', institutionName: 'GTBank', accountNumberMasked: '****1111', status: MonoLinkStatus.ACTIVE, lastSyncedAt: NOW, reauthRequiredAt: null },
        { id: 'acc-2', institutionName: 'Access Bank', accountNumberMasked: '****2222', status: MonoLinkStatus.REQUIRES_REAUTH, lastSyncedAt: new Date('2026-07-29T00:00:00Z'), reauthRequiredAt: new Date('2026-07-30T10:00:00Z') },
        { id: 'acc-3', institutionName: 'Zenith Bank', accountNumberMasked: '****3333', status: MonoLinkStatus.REVOKED, lastSyncedAt: null, reauthRequiredAt: null },
      ]);

      const result = await service.getOverview(buildUnrestrictedScope(), 'entity-1');

      expect(prisma.monoLinkedAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bankAccount: { entityId: 'entity-1' } } }),
      );
      expect(result.totalLinked).toBe(3);
      expect(result.byStatus).toEqual({ ACTIVE: 1, REVOKED: 1, REQUIRES_REAUTH: 1 });
      expect(result.needsReauth).toEqual([
        { id: 'acc-2', institutionName: 'Access Bank', accountNumberMasked: '****2222', reauthRequiredAt: new Date('2026-07-30T10:00:00Z') },
      ]);
    });

    it('flags an ACTIVE account as stale when lastSyncedAt is null or older than 24 hours, but not a REVOKED/REQUIRES_REAUTH account', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([
        { id: 'acc-fresh', institutionName: 'GTBank', accountNumberMasked: '****1111', status: MonoLinkStatus.ACTIVE, lastSyncedAt: new Date('2026-07-30T11:00:00Z'), reauthRequiredAt: null },
        { id: 'acc-stale', institutionName: 'UBA', accountNumberMasked: '****4444', status: MonoLinkStatus.ACTIVE, lastSyncedAt: new Date('2026-07-29T00:00:00Z'), reauthRequiredAt: null },
        { id: 'acc-never-synced', institutionName: 'First Bank', accountNumberMasked: '****5555', status: MonoLinkStatus.ACTIVE, lastSyncedAt: null, reauthRequiredAt: null },
        { id: 'acc-revoked-old', institutionName: 'Old Bank', accountNumberMasked: '****9999', status: MonoLinkStatus.REVOKED, lastSyncedAt: null, reauthRequiredAt: null },
      ]);

      const result = await service.getOverview(buildUnrestrictedScope(), 'entity-1');

      expect(result.staleActiveAccounts.map((a: { id: string }) => a.id).sort()).toEqual(['acc-never-synced', 'acc-stale']);
    });

    it('returns empty lists and zeroed counts when the entity has no linked accounts', async () => {
      prisma.monoLinkedAccount.findMany.mockResolvedValue([]);

      const result = await service.getOverview(buildUnrestrictedScope(), 'entity-1');

      expect(result).toEqual({
        entityId: 'entity-1',
        totalLinked: 0,
        byStatus: { ACTIVE: 0, REVOKED: 0, REQUIRES_REAUTH: 0 },
        needsReauth: [],
        staleActiveAccounts: [],
      });
    });
  });
});
