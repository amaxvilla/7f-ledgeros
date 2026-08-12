import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import { HrPayrollService } from '../hr-payroll.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PostingEngineService } from '../../general-ledger/posting-engine.service';

describe('HrPayrollService', () => {
  let service: HrPayrollService;
  let prisma: any;
  let postingEngine: { postSystemEntry: jest.Mock };

  beforeEach(async () => {
    prisma = {
      salaryStructure: { findUnique: jest.fn(), create: jest.fn() },
      employee: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      payrollRun: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      payslip: { upsert: jest.fn() },
    };
    postingEngine = { postSystemEntry: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        HrPayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: PostingEngineService, useValue: postingEngine },
      ],
    }).compile();

    service = moduleRef.get(HrPayrollService);
  });

  describe('calculatePayrollRun', () => {
    it('computes gross pay, statutory deductions, and net pay for each employee', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue({
        id: 'run-1',
        entityId: 'entity-1',
        status: PayrollRunStatus.DRAFT,
      });
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'emp-1',
          salaryStructure: {
            basicSalary: 500_000,
            housingAllowance: 100_000,
            transportAllowance: 50_000,
            otherAllowances: 0,
          },
        },
      ]);
      prisma.payslip.upsert.mockImplementation(({ create }: any) => Promise.resolve(create));
      prisma.payrollRun.update.mockResolvedValue({});

      const [payslip] = await service.calculatePayrollRun('run-1');

      expect(payslip.grossPay).toBe(650_000);
      // pensionable pay = 500,000 + 100,000 + 50,000 = 650,000
      expect(payslip.pensionEmployee).toBeCloseTo(650_000 * 0.08, 5);
      expect(payslip.pensionEmployer).toBeCloseTo(650_000 * 0.1, 5);
      expect(payslip.nhfDeduction).toBeCloseTo(500_000 * 0.025, 5);
      // netPay must equal gross minus every deduction
      expect(payslip.netPay).toBeCloseTo(
        Number(payslip.grossPay) - Number(payslip.payeTax) - Number(payslip.pensionEmployee) - Number(payslip.nhfDeduction),
        5,
      );
      expect(payslip.payeTax).toBeGreaterThan(0);
    });

    it('refuses to calculate a run that is not DRAFT', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 'run-1', status: PayrollRunStatus.POSTED });
      await expect(service.calculatePayrollRun('run-1')).rejects.toThrow(ConflictException);
    });

    it('refuses to calculate when no employees have a salary structure', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 'run-1', entityId: 'entity-1', status: PayrollRunStatus.DRAFT });
      prisma.employee.findMany.mockResolvedValue([]);
      await expect(service.calculatePayrollRun('run-1')).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a missing run', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue(null);
      await expect(service.calculatePayrollRun('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('postPayrollRun — journal balance identity', () => {
    const baseDto = {
      payrollRunId: 'run-1',
      entityId: 'entity-1',
      entryDate: '2026-07-31',
      salaryExpenseGlId: 'acc-salary-exp',
      employerPensionExpenseGlId: 'acc-pension-exp',
      payePayableGlId: 'acc-paye',
      pensionPayableGlId: 'acc-pension-payable',
      nhfPayableGlId: 'acc-nhf',
      netSalariesPayableGlId: 'acc-net-payable',
      systemUserId: 'system-user',
    };

    it('posts a balanced journal: Dr(gross + employer pension) === Cr(everything else)', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue({
        id: 'run-1',
        payPeriodName: '2026-07',
        status: PayrollRunStatus.APPROVED,
        payslips: [
          {
            grossPay: 650_000,
            payeTax: 50_000,
            pensionEmployee: 52_000,
            pensionEmployer: 65_000,
            nhfDeduction: 12_500,
            otherDeductions: 0,
            netPay: 535_500,
          },
          {
            grossPay: 400_000,
            payeTax: 20_000,
            pensionEmployee: 32_000,
            pensionEmployer: 40_000,
            nhfDeduction: 7_500,
            otherDeductions: 5_000,
            netPay: 335_500,
          },
        ],
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-1', journalNumber: '7FC-JE-2026-000020' });
      prisma.payrollRun.update.mockResolvedValue({});

      const result = await service.postPayrollRun({ ...baseDto, otherDeductionsPayableGlId: 'acc-other' });

      const [dto] = postingEngine.postSystemEntry.mock.calls[0];
      const totalDebit = dto.lines.reduce((s: number, l: any) => s + l.debit, 0);
      const totalCredit = dto.lines.reduce((s: number, l: any) => s + l.credit, 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 5);
      expect(totalDebit).toBeCloseTo(650_000 + 400_000 + 65_000 + 40_000, 5); // gross + employer pension
      expect(result.totals.netPay).toBeCloseTo(535_500 + 335_500, 5);
    });

    it('omits the other-deductions line when there are none', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue({
        id: 'run-1',
        payPeriodName: '2026-07',
        status: PayrollRunStatus.APPROVED,
        payslips: [
          {
            grossPay: 650_000,
            payeTax: 50_000,
            pensionEmployee: 52_000,
            pensionEmployer: 65_000,
            nhfDeduction: 12_500,
            otherDeductions: 0,
            netPay: 535_500,
          },
        ],
      });
      postingEngine.postSystemEntry.mockResolvedValue({ id: 'je-1' });
      prisma.payrollRun.update.mockResolvedValue({});

      await service.postPayrollRun(baseDto);
      const [dto] = postingEngine.postSystemEntry.mock.calls[0];
      expect(dto.lines).toHaveLength(6); // no other-deductions line
    });

    it('refuses to post a run that is not APPROVED', async () => {
      prisma.payrollRun.findUnique.mockResolvedValue({ id: 'run-1', status: PayrollRunStatus.CALCULATED, payslips: [] });
      await expect(service.postPayrollRun(baseDto)).rejects.toThrow(ConflictException);
    });
  });
});
