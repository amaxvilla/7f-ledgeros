import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TrustedDeviceService } from '../trusted-device.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    trustedDevice: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
}

describe('TrustedDeviceService', () => {
  let service: TrustedDeviceService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [TrustedDeviceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TrustedDeviceService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('trustDevice', () => {
    it('creates a device record and returns the plaintext token exactly once', async () => {
      prisma.trustedDevice.create.mockImplementation(({ data }: any) => ({ id: 'd1', ...data }));
      const result = await service.trustDevice('u1', { deviceName: 'Chrome on Mac' });

      expect(result.deviceId).toBe('d1');
      expect(typeof result.deviceToken).toBe('string');
      expect(result.deviceToken.length).toBeGreaterThan(0);

      const created = prisma.trustedDevice.create.mock.calls[0][0].data;
      expect(created.tokenHash).not.toBe(result.deviceToken); // only the hash is persisted
      expect(created.userId).toBe('u1');
      expect(created.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('checkTrustedDevice', () => {
    it('returns null (never throws) when no matching device is found', async () => {
      prisma.trustedDevice.findFirst.mockResolvedValue(null);
      const result = await service.checkTrustedDevice('u1', 'bad-token');
      expect(result).toBeNull();
    });

    it('returns the device id and touches lastUsedAt on a valid match', async () => {
      prisma.trustedDevice.findFirst.mockResolvedValue({ id: 'd1' });
      prisma.trustedDevice.update.mockResolvedValue({ id: 'd1' });
      const result = await service.checkTrustedDevice('u1', 'good-token');
      expect(result).toBe('d1');
      expect(prisma.trustedDevice.update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeDevice', () => {
    it('throws NotFoundException when the device does not exist', async () => {
      prisma.trustedDevice.findUnique.mockResolvedValue(null);
      await expect(service.revokeDevice('u1', 'd1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the device belongs to another user', async () => {
      prisma.trustedDevice.findUnique.mockResolvedValue({ id: 'd1', userId: 'someone-else' });
      await expect(service.revokeDevice('u1', 'd1')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('revokes the device and any live sessions issued via it', async () => {
      prisma.trustedDevice.findUnique.mockResolvedValue({ id: 'd1', userId: 'u1' });
      await service.revokeDevice('u1', 'd1');
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('renameDevice', () => {
    it('throws NotFoundException when the device does not exist', async () => {
      prisma.trustedDevice.findUnique.mockResolvedValue(null);
      await expect(service.renameDevice('u1', 'd1', 'My laptop')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the device belongs to another user', async () => {
      prisma.trustedDevice.findUnique.mockResolvedValue({ id: 'd1', userId: 'someone-else' });
      await expect(service.renameDevice('u1', 'd1', 'My laptop')).rejects.toThrow(ForbiddenException);
      expect(prisma.trustedDevice.update).not.toHaveBeenCalled();
    });

    it('updates the device name and does not touch any session', async () => {
      prisma.trustedDevice.findUnique.mockResolvedValue({ id: 'd1', userId: 'u1' });
      prisma.trustedDevice.update.mockResolvedValue({ id: 'd1', userId: 'u1', deviceName: 'My laptop' });

      const result = await service.renameDevice('u1', 'd1', 'My laptop');

      expect(prisma.trustedDevice.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { deviceName: 'My laptop' } });
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(result.deviceName).toBe('My laptop');
    });
  });
});
