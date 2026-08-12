import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BackgroundCheckStatus } from '@prisma/client';
import { BackgroundCheckService } from '../background-check.service';
import { PrismaService } from '../../prisma/prisma.service';

function buildPrismaMock() {
  return {
    jobApplication: { findUnique: jest.fn() },
    backgroundCheck: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
}

describe('BackgroundCheckService', () => {
  let service: BackgroundCheckService;
  let prisma: ReturnType<typeof buildPrismaMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [BackgroundCheckService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(BackgroundCheckService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('start', () => {
    it('throws if the application does not exist', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue(null);
      await expect(service.start({ jobApplicationId: 'a1', checkType: 'Criminal Record' }, 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if a background check already exists for this application', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.backgroundCheck.findUnique.mockResolvedValue({ id: 'bc1' });
      await expect(service.start({ jobApplicationId: 'a1', checkType: 'Criminal Record' }, 'u1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates an IN_PROGRESS check for a valid application', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'a1' });
      prisma.backgroundCheck.findUnique.mockResolvedValue(null);
      prisma.backgroundCheck.create.mockResolvedValue({ id: 'bc1', status: BackgroundCheckStatus.IN_PROGRESS });

      await service.start({ jobApplicationId: 'a1', checkType: 'Reference Check' }, 'u1');

      expect(prisma.backgroundCheck.create).toHaveBeenCalledWith({
        data: {
          jobApplicationId: 'a1',
          checkType: 'Reference Check',
          status: BackgroundCheckStatus.IN_PROGRESS,
          initiatedById: 'u1',
        },
      });
    });
  });

  describe('complete', () => {
    it('throws if the check does not exist', async () => {
      prisma.backgroundCheck.findUnique.mockResolvedValue(null);
      await expect(service.complete('missing', true)).rejects.toThrow(NotFoundException);
    });

    it('marks the check CLEARED when cleared=true', async () => {
      prisma.backgroundCheck.findUnique.mockResolvedValue({ id: 'bc1' });
      await service.complete('bc1', true, 'all clear');
      expect(prisma.backgroundCheck.update).toHaveBeenCalledWith({
        where: { id: 'bc1' },
        data: expect.objectContaining({ status: BackgroundCheckStatus.CLEARED, notes: 'all clear' }),
      });
    });

    it('marks the check FLAGGED when cleared=false', async () => {
      prisma.backgroundCheck.findUnique.mockResolvedValue({ id: 'bc1' });
      await service.complete('bc1', false);
      expect(prisma.backgroundCheck.update).toHaveBeenCalledWith({
        where: { id: 'bc1' },
        data: expect.objectContaining({ status: BackgroundCheckStatus.FLAGGED }),
      });
    });
  });
});
