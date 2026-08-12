import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IpRuleScope } from '@prisma/client';
import { IpRestrictionService } from '../ip-restriction.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    ipAllowlistRule: { create: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
}

describe('IpRestrictionService', () => {
  let service: IpRestrictionService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [IpRestrictionService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(IpRestrictionService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createRule', () => {
    it('requires userId for a USER-scoped rule', async () => {
      await expect(
        service.createRule({ scope: IpRuleScope.USER, cidr: '203.0.113.0/24' }, 'admin1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.ipAllowlistRule.create).not.toHaveBeenCalled();
    });

    it('rejects userId on a GLOBAL-scoped rule', async () => {
      await expect(
        service.createRule({ scope: IpRuleScope.GLOBAL, userId: 'u1', cidr: '203.0.113.0/24' }, 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a malformed CIDR', async () => {
      await expect(
        service.createRule({ scope: IpRuleScope.GLOBAL, cidr: 'garbage' }, 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a valid GLOBAL rule', async () => {
      prisma.ipAllowlistRule.create.mockResolvedValue({ id: 'r1' });
      const result = await service.createRule({ scope: IpRuleScope.GLOBAL, cidr: '203.0.113.0/24', label: 'HQ' }, 'admin1');
      expect(result).toEqual({ id: 'r1' });
      expect(prisma.ipAllowlistRule.create).toHaveBeenCalledWith({
        data: { scope: IpRuleScope.GLOBAL, userId: null, cidr: '203.0.113.0/24', label: 'HQ', createdById: 'admin1' },
      });
    });

    it('creates a valid USER rule', async () => {
      prisma.ipAllowlistRule.create.mockResolvedValue({ id: 'r2' });
      await service.createRule({ scope: IpRuleScope.USER, userId: 'u1', cidr: '203.0.113.5/32' }, 'admin1');
      expect(prisma.ipAllowlistRule.create).toHaveBeenCalledWith({
        data: { scope: IpRuleScope.USER, userId: 'u1', cidr: '203.0.113.5/32', label: undefined, createdById: 'admin1' },
      });
    });
  });

  describe('isIpAllowed', () => {
    it('is unrestricted when no active rules apply', async () => {
      prisma.ipAllowlistRule.findMany.mockResolvedValue([]);
      expect(await service.isIpAllowed('198.51.100.1', 'u1')).toBe(true);
    });

    it('allows a matching IP once a rule applies', async () => {
      prisma.ipAllowlistRule.findMany.mockResolvedValue([{ cidr: '203.0.113.0/24' }]);
      expect(await service.isIpAllowed('203.0.113.42', 'u1')).toBe(true);
    });

    it('blocks a non-matching IP once a rule applies', async () => {
      prisma.ipAllowlistRule.findMany.mockResolvedValue([{ cidr: '203.0.113.0/24' }]);
      expect(await service.isIpAllowed('198.51.100.1', 'u1')).toBe(false);
    });

    it('fails closed when rules apply but no address was supplied', async () => {
      prisma.ipAllowlistRule.findMany.mockResolvedValue([{ cidr: '203.0.113.0/24' }]);
      expect(await service.isIpAllowed(undefined, 'u1')).toBe(false);
    });

    it('queries for both GLOBAL rules and this user\'s USER-scoped rules', async () => {
      prisma.ipAllowlistRule.findMany.mockResolvedValue([]);
      await service.isIpAllowed('203.0.113.1', 'u1');
      const where = prisma.ipAllowlistRule.findMany.mock.calls[0][0].where;
      expect(where.isActive).toBe(true);
      expect(where.OR).toEqual([
        { scope: IpRuleScope.GLOBAL },
        { scope: IpRuleScope.USER, userId: 'u1' },
      ]);
    });
  });
});
