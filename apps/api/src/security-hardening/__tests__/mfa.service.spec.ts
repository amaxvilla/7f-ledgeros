import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { generateSecret, generate } from 'otplib';
import { MfaService } from '../mfa.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    mfaRecoveryCode: {
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn((ops: any[]) => Promise.all(ops)),
  };
}

describe('MfaService', () => {
  let service: MfaService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [MfaService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(MfaService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('beginEnrollment', () => {
    it('rejects if MFA is already enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@x.com', mfaEnabled: true });
      await expect(service.beginEnrollment('u1')).rejects.toThrow(ConflictException);
    });

    it('generates a secret, stores it unconfirmed, and returns a QR code data URL', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@x.com', mfaEnabled: false });
      const result = await service.beginEnrollment('u1');

      expect(result.secret).toBeTruthy();
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { mfaSecret: expect.any(String) },
      });
    }, 15000);
  });

  describe('confirmEnrollment', () => {
    it('rejects an invalid TOTP code and does not enable MFA', async () => {
      const secret = generateSecret();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: false, mfaSecret: secret });

      await expect(service.confirmEnrollment('u1', '000000')).rejects.toThrow(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects if there is no enrollment in progress', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: false, mfaSecret: null });
      await expect(service.confirmEnrollment('u1', '123456')).rejects.toThrow(BadRequestException);
    });

    it('enables MFA and returns 10 plaintext recovery codes for a valid TOTP code', async () => {
      const secret = generateSecret();
      const validToken = await generate({ secret });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: false, mfaSecret: secret });

      const result = await service.confirmEnrollment('u1', validToken);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { mfaEnabled: true, mfaEnrolledAt: expect.any(Date) },
      });
      expect(result.recoveryCodes).toHaveLength(10);
      // Every code is a distinct 10-hex-char string
      expect(new Set(result.recoveryCodes).size).toBe(10);
      expect(prisma.mfaRecoveryCode.createMany).toHaveBeenCalled();
      const createdRows = prisma.mfaRecoveryCode.createMany.mock.calls[0][0].data;
      expect(createdRows).toHaveLength(10);
      // Only hashes are persisted, never the plaintext code
      expect(createdRows[0].codeHash).not.toBe(result.recoveryCodes[0]);
    });
  });

  describe('verifyLoginCode', () => {
    it('accepts a valid live TOTP code', async () => {
      const secret = generateSecret();
      const validToken = await generate({ secret });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: true, mfaSecret: secret });

      const result = await service.verifyLoginCode('u1', validToken);
      expect(result.usedRecoveryCode).toBe(false);
      expect(prisma.mfaRecoveryCode.findFirst).not.toHaveBeenCalled();
    });

    it('falls back to an unused recovery code and marks it used', async () => {
      const secret = generateSecret();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: true, mfaSecret: secret });
      prisma.mfaRecoveryCode.findFirst.mockResolvedValue({ id: 'rc-1', usedAt: null });

      const result = await service.verifyLoginCode('u1', 'abc1234567');
      expect(result.usedRecoveryCode).toBe(true);
      expect(prisma.mfaRecoveryCode.update).toHaveBeenCalledWith({
        where: { id: 'rc-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('rejects a code that matches neither TOTP nor an unused recovery code', async () => {
      const secret = generateSecret();
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: true, mfaSecret: secret });
      prisma.mfaRecoveryCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyLoginCode('u1', 'wrong-code')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects if MFA is not enabled on the account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: false, mfaSecret: null });
      await expect(service.verifyLoginCode('u1', '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('disableMfa', () => {
    it('requires a valid code and clears the secret + recovery codes on success', async () => {
      const secret = generateSecret();
      const validToken = await generate({ secret });
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: true, mfaSecret: secret });

      await service.disableMfa('u1', validToken);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { mfaEnabled: false, mfaSecret: null, mfaEnrolledAt: null },
      });
      expect(prisma.mfaRecoveryCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    });

    it('rejects if MFA is not currently enabled', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', mfaEnabled: false });
      await expect(service.disableMfa('u1', '123456')).rejects.toThrow(BadRequestException);
    });
  });
});
