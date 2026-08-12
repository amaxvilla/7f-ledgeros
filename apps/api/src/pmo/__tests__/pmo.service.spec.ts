import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PmoDocStatus } from '@prisma/client';
import { PmoService } from '../pmo.service';
import { PrismaService } from '../../prisma/prisma.service';
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

describe('PmoService', () => {
  let service: PmoService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      boq: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      workPackage: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      progressValuation: { findUnique: jest.fn(), update: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      interimPaymentCertificate: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      variationOrder: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      retention: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      retentionRelease: { create: jest.fn() },
      finalAccount: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PmoService, RowLevelSecurityService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PmoService);
  });

  describe('generateCertificate — IPC arithmetic', () => {
    const baseDto = {
      progressValuationId: 'pv-2',
      certificateNumber: 'IPC-002',
      retentionPercent: 10,
      issuedDate: '2026-08-01',
      createdById: 'user-1',
    };

    it('computes net payable for the first certificate (no prior certificates)', async () => {
      prisma.progressValuation.findUnique.mockResolvedValue({
        id: 'pv-1',
        workPackageId: 'wp-1',
        valuationAmount: 1_000_000,
        status: PmoDocStatus.APPROVED,
        certificate: null,
      });
      prisma.interimPaymentCertificate.findMany.mockResolvedValue([]);
      prisma.interimPaymentCertificate.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result = await service.generateCertificate({ ...baseDto, progressValuationId: 'pv-1' });

      expect(result.retentionAmount).toBe(100_000); // 10% of 1,000,000
      expect(result.previousCertifiedAmount).toBe(0);
      expect(result.netPayableAmount).toBe(900_000); // 1,000,000 - 100,000 - 0
    });

    it('computes net payable for a second certificate net of prior certified amounts', async () => {
      prisma.progressValuation.findUnique.mockResolvedValue({
        id: 'pv-2',
        workPackageId: 'wp-1',
        valuationAmount: 2_000_000, // cumulative
        status: PmoDocStatus.APPROVED,
        certificate: null,
      });
      prisma.interimPaymentCertificate.findMany.mockResolvedValue([{ netPayableAmount: 900_000 }]);
      prisma.interimPaymentCertificate.create.mockImplementation(({ data }: any) => Promise.resolve(data));

      const result = await service.generateCertificate(baseDto);

      expect(result.retentionAmount).toBe(200_000); // 10% of 2,000,000
      expect(result.previousCertifiedAmount).toBe(900_000);
      // netCumulative = 2,000,000 - 200,000 = 1,800,000; minus previous 900,000
      expect(result.netPayableAmount).toBe(900_000);
    });

    it('refuses to certify a valuation that is not APPROVED', async () => {
      prisma.progressValuation.findUnique.mockResolvedValue({
        id: 'pv-1',
        workPackageId: 'wp-1',
        valuationAmount: 1_000_000,
        status: PmoDocStatus.DRAFT,
        certificate: null,
      });
      await expect(service.generateCertificate(baseDto)).rejects.toThrow(ConflictException);
    });

    it('refuses to double-certify the same valuation', async () => {
      prisma.progressValuation.findUnique.mockResolvedValue({
        id: 'pv-1',
        workPackageId: 'wp-1',
        valuationAmount: 1_000_000,
        status: PmoDocStatus.APPROVED,
        certificate: { id: 'ipc-existing' },
      });
      await expect(service.generateCertificate(baseDto)).rejects.toThrow(ConflictException);
    });

    it('rejects an out-of-range retention percent', async () => {
      await expect(
        service.generateCertificate({ ...baseDto, retentionPercent: 150 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('workflow transitions (advanceGeneric)', () => {
    it('allows moving DRAFT -> REVIEWED', async () => {
      prisma.boq.findUnique.mockResolvedValue({ id: 'boq-1', status: PmoDocStatus.DRAFT });
      prisma.boq.update.mockResolvedValue({ id: 'boq-1', status: PmoDocStatus.REVIEWED });

      const result = await service.advanceBoqStatus('boq-1', PmoDocStatus.REVIEWED);
      expect(result.status).toBe(PmoDocStatus.REVIEWED);
    });

    it('refuses to skip a workflow step (DRAFT -> APPROVED)', async () => {
      prisma.boq.findUnique.mockResolvedValue({ id: 'boq-1', status: PmoDocStatus.DRAFT });
      await expect(service.advanceBoqStatus('boq-1', PmoDocStatus.APPROVED)).rejects.toThrow(ConflictException);
    });

    it('refuses to move backward', async () => {
      prisma.boq.findUnique.mockResolvedValue({ id: 'boq-1', status: PmoDocStatus.APPROVED });
      await expect(service.advanceBoqStatus('boq-1', PmoDocStatus.DRAFT)).rejects.toThrow(ConflictException);
    });

    it('refuses to reject a CERTIFIED document', async () => {
      prisma.boq.findUnique.mockResolvedValue({ id: 'boq-1', status: PmoDocStatus.CERTIFIED });
      await expect(service.advanceBoqStatus('boq-1', PmoDocStatus.REJECTED)).rejects.toThrow(ConflictException);
    });

    it('allows rejecting a DRAFT document', async () => {
      prisma.boq.findUnique.mockResolvedValue({ id: 'boq-1', status: PmoDocStatus.DRAFT });
      prisma.boq.update.mockResolvedValue({ id: 'boq-1', status: PmoDocStatus.REJECTED });
      const result = await service.advanceBoqStatus('boq-1', PmoDocStatus.REJECTED);
      expect(result.status).toBe(PmoDocStatus.REJECTED);
    });

    it('throws NotFoundException for a missing record', async () => {
      prisma.boq.findUnique.mockResolvedValue(null);
      await expect(service.advanceBoqStatus('missing', PmoDocStatus.REVIEWED)).rejects.toThrow(NotFoundException);
    });
  });

  describe('releaseRetention', () => {
    it('refuses to release more than is available', async () => {
      prisma.retention.findUnique.mockResolvedValue({ id: 'ret-1', totalHeld: 100_000, totalReleased: 80_000 });
      await expect(service.releaseRetention('ret-1', 30_000, '2026-08-01', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('releases an amount within the available balance', async () => {
      prisma.retention.findUnique.mockResolvedValue({ id: 'ret-1', totalHeld: 100_000, totalReleased: 0 });
      prisma.$transaction.mockResolvedValue([{}, { id: 'ret-1', totalHeld: 100_000, totalReleased: 40_000 }]);

      const result = await service.releaseRetention('ret-1', 40_000, '2026-08-01', 'user-1');
      expect(result.totalReleased).toBe(40_000);
    });
  });

  describe('Row Level Security (Phase 2)', () => {
    it('findBoqs scopes results to the caller\'s viewable projects', async () => {
      prisma.boq.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        project: { unrestricted: false, viewableIds: ['proj-1'], postableIds: [] },
      };

      await service.findBoqs(scope, undefined);

      expect(prisma.boq.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ projectId: { in: ['proj-1'] } }, { projectId: undefined }] },
        }),
      );
    });

    it('findWorkPackages scopes results to the caller\'s viewable projects', async () => {
      prisma.workPackage.findMany.mockResolvedValue([]);
      const scope: SecurityScope = {
        ...buildUnrestrictedScope(),
        isSystemAdmin: false,
        project: { unrestricted: false, viewableIds: ['proj-1'], postableIds: [] },
      };

      await service.findWorkPackages(scope, undefined);

      expect(prisma.workPackage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { AND: [{ projectId: { in: ['proj-1'] } }, { projectId: undefined }] },
        }),
      );
    });
  });
});
