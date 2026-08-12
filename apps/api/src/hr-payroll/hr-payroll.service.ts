import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostingEngineService } from '../general-ledger/posting-engine.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';

interface CreateSalaryStructureDto {
  entityId: string;
  code: string;
  name: string;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: number;
}

interface CreateEmployeeDto {
  entityId: string;
  departmentId?: string;
  salaryStructureId?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
}

interface PostPayrollRunDto {
  payrollRunId: string;
  entityId: string;
  entryDate: string;
  salaryExpenseGlId: string;
  employerPensionExpenseGlId: string;
  payePayableGlId: string;
  pensionPayableGlId: string;
  nhfPayableGlId: string;
  netSalariesPayableGlId: string;
  otherDeductionsPayableGlId?: string;
  systemUserId: string;
}

/**
 * Simplified Nigerian PAYE bands (annual, in NGN) applied to taxable
 * income after Consolidated Relief Allowance. Rates are illustrative of
 * the standard progressive structure — a production payroll system
 * should keep this table config-driven and reviewed against current FIRS
 * guidance rather than hard-coded.
 */
const PAYE_BANDS: { upTo: number; rate: number }[] = [
  { upTo: 300_000, rate: 0.07 },
  { upTo: 600_000, rate: 0.11 },
  { upTo: 1_100_000, rate: 0.15 },
  { upTo: 1_600_000, rate: 0.19 },
  { upTo: 3_200_000, rate: 0.21 },
  { upTo: Infinity, rate: 0.24 },
];

function computeAnnualPAYE(annualGrossIncome: number, annualPensionAndNhf: number): number {
  // Consolidated Relief Allowance: higher of ₦200,000 or 1% of gross, plus 20% of gross.
  const cra = Math.max(200_000, annualGrossIncome * 0.01) + annualGrossIncome * 0.2;
  const taxableIncome = Math.max(0, annualGrossIncome - cra - annualPensionAndNhf);

  let remaining = taxableIncome;
  let previousCap = 0;
  let tax = 0;
  for (const band of PAYE_BANDS) {
    const bandWidth = band.upTo - previousCap;
    const taxedInBand = Math.min(remaining, bandWidth);
    if (taxedInBand <= 0) break;
    tax += taxedInBand * band.rate;
    remaining -= taxedInBand;
    previousCap = band.upTo;
  }
  return tax;
}

@Injectable()
export class HrPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly postingEngine: PostingEngineService,
    // Phase 2 RLS: @Optional() + default instance means existing test modules
    // that build this service without registering RowLevelSecurityService
    // keep working unchanged (Nest injects `undefined`, JS default applies);
    // the running app gets the real shared singleton from the global
    // SecurityModule.
    @Optional() private readonly rowLevelSecurity: RowLevelSecurityService = new RowLevelSecurityService(),
  ) {}

  // ---- Salary structures ----

  async createSalaryStructure(dto: CreateSalaryStructureDto) {
    const existing = await this.prisma.salaryStructure.findUnique({
      where: { entityId_code: { entityId: dto.entityId, code: dto.code } },
    });
    if (existing) throw new ConflictException(`Salary structure code "${dto.code}" already exists for this entity`);
    if (dto.basicSalary <= 0) throw new BadRequestException('Basic salary must be positive');

    return this.prisma.salaryStructure.create({
      data: {
        entityId: dto.entityId,
        code: dto.code,
        name: dto.name,
        basicSalary: dto.basicSalary,
        housingAllowance: dto.housingAllowance ?? 0,
        transportAllowance: dto.transportAllowance ?? 0,
        otherAllowances: dto.otherAllowances ?? 0,
      },
    });
  }

  findSalaryStructures(entityId?: string, scope?: SecurityScope) {
    const rls = scope ? this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity'] }) : {};
    const explicit = entityId ? { entityId } : {};
    return this.prisma.salaryStructure.findMany({
      where: Object.keys(rls).length ? { AND: [rls, explicit] } : explicit,
    });
  }

  // ---- Employees ----

  async createEmployee(dto: CreateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({
      where: { entityId_employeeCode: { entityId: dto.entityId, employeeCode: dto.employeeCode } },
    });
    if (existing) throw new ConflictException(`Employee code "${dto.employeeCode}" already exists for this entity`);

    return this.prisma.employee.create({
      data: {
        entityId: dto.entityId,
        departmentId: dto.departmentId,
        salaryStructureId: dto.salaryStructureId,
        employeeCode: dto.employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });
  }

  findEmployees(entityId?: string, scope?: SecurityScope) {
    const rls = scope ? this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'department'] }) : {};
    const explicit = { ...(entityId ? { entityId } : {}), isActive: true };
    return this.prisma.employee.findMany({
      where: Object.keys(rls).length ? { AND: [rls, explicit] } : explicit,
      include: { department: true, salaryStructure: true },
    });
  }

  // ---- Payroll runs ----

  async createPayrollRun(entityId: string, payPeriodName: string, payPeriodStart: string, payPeriodEnd: string, createdById: string) {
    const existing = await this.prisma.payrollRun.findUnique({
      where: { entityId_payPeriodName: { entityId, payPeriodName } },
    });
    if (existing) throw new ConflictException(`Payroll run for ${payPeriodName} already exists for this entity`);

    return this.prisma.payrollRun.create({
      data: {
        entityId,
        payPeriodName,
        payPeriodStart: new Date(payPeriodStart),
        payPeriodEnd: new Date(payPeriodEnd),
        createdById,
        status: PayrollRunStatus.DRAFT,
      },
    });
  }

  /**
   * Calculates a payslip for every active employee in the run's entity
   * who has a salary structure assigned. Re-running calculate() on a
   * still-DRAFT run recalculates cleanly (payslips are upserted).
   */
  async calculatePayrollRun(payrollRunId: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!run) throw new NotFoundException(`Payroll run ${payrollRunId} not found`);
    if (run.status !== PayrollRunStatus.DRAFT) {
      throw new ConflictException(`Payroll run must be DRAFT to calculate (currently ${run.status})`);
    }

    const employees = await this.prisma.employee.findMany({
      where: { entityId: run.entityId, isActive: true, salaryStructureId: { not: null } },
      include: { salaryStructure: true },
    });
    if (employees.length === 0) {
      throw new BadRequestException('No active employees with a salary structure found for this entity');
    }

    const payslips = [];
    for (const emp of employees) {
      const ss = emp.salaryStructure!;
      const basicSalary = Number(ss.basicSalary);
      const housingAllowance = Number(ss.housingAllowance);
      const transportAllowance = Number(ss.transportAllowance);
      const otherAllowances = Number(ss.otherAllowances);
      const grossPay = basicSalary + housingAllowance + transportAllowance + otherAllowances;

      // Standard Nigerian formula: pensionable pay = basic + housing + transport.
      const pensionablePay = basicSalary + housingAllowance + transportAllowance;
      const pensionEmployee = pensionablePay * 0.08;
      const pensionEmployer = pensionablePay * 0.1;
      const nhfDeduction = basicSalary * 0.025;

      const annualPAYE = computeAnnualPAYE(grossPay * 12, (pensionEmployee + nhfDeduction) * 12);
      const payeTax = annualPAYE / 12;

      const netPay = grossPay - payeTax - pensionEmployee - nhfDeduction;

      const payslip = await this.prisma.payslip.upsert({
        where: { payrollRunId_employeeId: { payrollRunId, employeeId: emp.id } },
        create: {
          payrollRunId,
          employeeId: emp.id,
          basicSalary,
          grossPay,
          payeTax,
          pensionEmployee,
          pensionEmployer,
          nhfDeduction,
          netPay,
        },
        update: { basicSalary, grossPay, payeTax, pensionEmployee, pensionEmployer, nhfDeduction, netPay },
      });
      payslips.push(payslip);
    }

    await this.prisma.payrollRun.update({
      where: { id: payrollRunId },
      data: { status: PayrollRunStatus.CALCULATED },
    });

    return payslips;
  }

  async approvePayrollRun(payrollRunId: string) {
    const run = await this.prisma.payrollRun.findUnique({ where: { id: payrollRunId } });
    if (!run) throw new NotFoundException(`Payroll run ${payrollRunId} not found`);
    if (run.status !== PayrollRunStatus.CALCULATED) {
      throw new ConflictException(`Payroll run must be CALCULATED to approve (currently ${run.status})`);
    }
    return this.prisma.payrollRun.update({ where: { id: payrollRunId }, data: { status: PayrollRunStatus.APPROVED } });
  }

  /**
   * Payroll journals must post automatically to the GL. Debits gross
   * salary expense and the employer's pension contribution; credits
   * every statutory/net payable. The two sides balance by construction:
   * Dr(grossPay + employerPension) === Cr(paye + pension + nhf + net +
   * otherDeductions) because netPay is defined as the residual of gross
   * after all deductions.
   */
  async postPayrollRun(dto: PostPayrollRunDto) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: dto.payrollRunId },
      include: { payslips: true },
    });
    if (!run) throw new NotFoundException(`Payroll run ${dto.payrollRunId} not found`);
    if (run.status !== PayrollRunStatus.APPROVED) {
      throw new ConflictException(`Payroll run must be APPROVED to post (currently ${run.status})`);
    }
    if (run.payslips.length === 0) {
      throw new BadRequestException('Payroll run has no payslips to post');
    }

    const totals = run.payslips.reduce(
      (acc, p) => ({
        grossPay: acc.grossPay + Number(p.grossPay),
        payeTax: acc.payeTax + Number(p.payeTax),
        pensionEmployee: acc.pensionEmployee + Number(p.pensionEmployee),
        pensionEmployer: acc.pensionEmployer + Number(p.pensionEmployer),
        nhfDeduction: acc.nhfDeduction + Number(p.nhfDeduction),
        otherDeductions: acc.otherDeductions + Number(p.otherDeductions),
        netPay: acc.netPay + Number(p.netPay),
      }),
      { grossPay: 0, payeTax: 0, pensionEmployee: 0, pensionEmployer: 0, nhfDeduction: 0, otherDeductions: 0, netPay: 0 },
    );

    const lines = [
      { accountId: dto.salaryExpenseGlId, debit: totals.grossPay, credit: 0 },
      { accountId: dto.employerPensionExpenseGlId, debit: totals.pensionEmployer, credit: 0 },
      { accountId: dto.payePayableGlId, debit: 0, credit: totals.payeTax },
      { accountId: dto.pensionPayableGlId, debit: 0, credit: totals.pensionEmployee + totals.pensionEmployer },
      { accountId: dto.nhfPayableGlId, debit: 0, credit: totals.nhfDeduction },
      { accountId: dto.netSalariesPayableGlId, debit: 0, credit: totals.netPay },
    ];
    if (totals.otherDeductions > 0 && dto.otherDeductionsPayableGlId) {
      lines.push({ accountId: dto.otherDeductionsPayableGlId, debit: 0, credit: totals.otherDeductions });
    }

    const posted = await this.postingEngine.postSystemEntry(
      {
        entityId: dto.entityId,
        entryDate: dto.entryDate,
        description: `Payroll journal — ${run.payPeriodName}`,
        sourceType: 'PAYROLL',
        sourceReference: run.id,
        lines,
      } as never,
      dto.systemUserId,
    );

    await this.prisma.payrollRun.update({
      where: { id: dto.payrollRunId },
      data: { status: PayrollRunStatus.POSTED, journalEntryId: posted.id },
    });

    return { journalEntry: posted, totals };
  }
}
