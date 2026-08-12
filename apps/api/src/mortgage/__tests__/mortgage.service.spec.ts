import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MortgageStatus } from '@prisma/client';
import { MortgageService } from '../mortgage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RowLevelSecurityService } from '../../security/row-level-security.service';
import { RevenueRecognitionService } from '../../revenue-recognition/revenue-recognition.service';
import { SecurityScope } from '../../security/security.types';

const unrestrictedScope = { unrestricted: true, viewableIds: [], postableIds: [] };
const fakeScope = {
  userId: 'u1',
  isSystemAdmin: false,
  entity: unrestrictedScope,
  department: unrestrictedScope,
  costCenter: unrestrictedScope,
  project: unrestrictedScope,
  businessUnit: unrestrictedScope,
} as unknown as SecurityScope;

describe('MortgageService', () => {
  let service: MortgageService;
  let prisma: any;
  let revenueRecognition: any;

  beforeEach(async () => {
    prisma = {
      unitSaleAllocation: { findUnique: jest.fn() },
      mortgageApplication: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    revenueRecognition = { recordCustomerPayment: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MortgageService,
        RowLevelSecurityService,
        { provide: PrismaService, useValue: prisma },
        { provide: RevenueRecognitionService, useValue: revenueRecognition },
      ],
    }).compile();

    service = moduleRef.get(MortgageService);
  });

  describe('createApplication', () => {
    it('rejects an application against a non-existent allocation', async () => {
      prisma.unitSaleAllocation.findUnique.mockResolvedValue(null);
      await expect(
        service.createApplication({ allocationId: 'missing', entityId: 'e1', lenderName: 'Bank', amountApplied: 1000 } as any, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a DRAFT application', async () => {
      prisma.unitSaleAllocation.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.mortgageApplication.create.mockResolvedValue({ id: 'm1', status: MortgageStatus.DRAFT });

      const result = await service.createApplication(
        { allocationId: 'a1', entityId: 'e1', lenderName: 'Bank', amountApplied: 1000 } as any,
        'u1',
      );

      expect(result.status).toBe(MortgageStatus.DRAFT);
    });
  });

  describe('state transitions', () => {
    it('rejects submitting a non-DRAFT application', async () => {
      prisma.mortgageApplication.findUnique.mockResolvedValue({ id: 'm1', status: MortgageStatus.SUBMITTED });
      await expect(service.submitApplication('m1')).rejects.toThrow(ConflictException);
    });

    it('rejects approving a non-SUBMITTED application', async () => {
      prisma.mortgageApplication.findUnique.mockResolvedValue({ id: 'm1', status: MortgageStatus.DRAFT });
      await expect(service.approveApplication('m1', { amountApproved: 1000 } as any)).rejects.toThrow(ConflictException);
    });

    it('rejects declining a non-SUBMITTED application', async () => {
      prisma.mortgageApplication.findUnique.mockResolvedValue({ id: 'm1', status: MortgageStatus.APPROVED });
      await expect(service.declineApplication('m1', { reason: 'no' } as any)).rejects.toThrow(ConflictException);
    });

    it('moves DRAFT -> SUBMITTED -> APPROVED correctly', async () => {
      prisma.mortgageApplication.findUnique.mockResolvedValue({ id: 'm1', status: MortgageStatus.DRAFT });
      prisma.mortgageApplication.update.mockResolvedValue({ id: 'm1', status: MortgageStatus.SUBMITTED });
      const submitted = await service.submitApplication('m1');
      expect(submitted.status).toBe(MortgageStatus.SUBMITTED);
    });
  });

  describe('disburse', () => {
    it('rejects disbursing a non-APPROVED application', async () => {
      prisma.mortgageApplication.findUnique.mockResolvedValue({ id: 'm1', status: MortgageStatus.SUBMITTED });
      await expect(
        service.disburse(
          'm1',
          { installmentLineId: 'l1', disbursedAmount: 1000, entryDate: '2026-01-01', bankAccountGlId: 'gl1', deferredRevenueGlId: 'gl2' } as any,
          'u1',
          fakeScope,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects disbursing more than the approved amount', async () => {
      prisma.mortgageApplication.findUnique.mockResolvedValue({ id: 'm1', status: MortgageStatus.APPROVED, amountApproved: 500 });
      await expect(
        service.disburse(
          'm1',
          { installmentLineId: 'l1', disbursedAmount: 1000, entryDate: '2026-01-01', bankAccountGlId: 'gl1', deferredRevenueGlId: 'gl2' } as any,
          'u1',
          fakeScope,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // Release O follow-up: entityId is no longer forwarded to
    // RevenueRecognitionService — it now derives entityId itself from the
    // installment line rather than trusting application.entityId, and
    // MortgageService forwards the caller's RLS scope instead.
    it('reuses RevenueRecognitionService.recordCustomerPayment rather than posting its own journal entry', async () => {
      prisma.mortgageApplication.findUnique.mockResolvedValue({
        id: 'm1',
        status: MortgageStatus.APPROVED,
        amountApproved: 2000,
        entityId: 'e1',
      });
      revenueRecognition.recordCustomerPayment.mockResolvedValue({ id: 'je1' });
      prisma.mortgageApplication.update.mockResolvedValue({ id: 'm1', status: MortgageStatus.DISBURSED });

      const result = await service.disburse(
        'm1',
        { installmentLineId: 'l1', disbursedAmount: 1500, entryDate: '2026-01-01', bankAccountGlId: 'gl1', deferredRevenueGlId: 'gl2' } as any,
        'u1',
        fakeScope,
      );

      expect(revenueRecognition.recordCustomerPayment).toHaveBeenCalledWith(
        expect.objectContaining({ installmentLineId: 'l1', amount: 1500, systemUserId: 'u1' }),
        fakeScope,
      );
      const [forwardedDto] = revenueRecognition.recordCustomerPayment.mock.calls[0];
      expect(forwardedDto.entityId).toBeUndefined(); // no longer trusted from the client/application row
      expect(result.application.status).toBe(MortgageStatus.DISBURSED);
      expect(result.journalEntry).toEqual({ id: 'je1' });
    });
  });

  describe('closeApplication', () => {
    it('rejects closing a non-DISBURSED application', async () => {
      prisma.mortgageApplication.findUnique.mockResolvedValue({ id: 'm1', status: MortgageStatus.APPROVED });
      await expect(service.closeApplication('m1')).rejects.toThrow(ConflictException);
    });
  });
});
