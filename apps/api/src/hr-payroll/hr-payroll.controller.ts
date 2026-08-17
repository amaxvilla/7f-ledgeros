import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HrPayrollService } from './hr-payroll.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MaskFields } from '../security/decorators/mask-fields.decorator';
import { SecurityContextService } from '../security/security-context.service';
import { RlsBodyCheck } from '../security/decorators/rls-dimensions.decorator';

/**
 * Salary structures, employee master records, and the four-stage
 * payroll run lifecycle (DRAFT -> CALCULATED -> APPROVED -> POSTED,
 * each transition its own dedicated route, one-way, guarded on the
 * run's own current status). calculatePayrollRun computes each active
 * employee's own payslip using a simplified progressive Nigerian PAYE
 * table (illustrative rates, not FIRS-guidance-verified — see this
 * file's own service-level comment) plus flat 8%/10% employee/employer
 * pension and 2.5% NHF deductions; re-running it while still DRAFT
 * recalculates cleanly (payslips are upserted, not duplicated).
 * postPayrollRun posts the run's own aggregate totals to the GL via the
 * standard posting engine — debits gross salary expense and employer
 * pension expense, credits every statutory/net payable, balancing by
 * construction. GET salary-structures/GET employees both mask sensitive
 * fields (salary components; bank details and tax/pension ids,
 * respectively) for callers without the matching unmask permission —
 * see @MaskFields' own documentation for exactly which permission that
 * is.
 */
@ApiTags('hr-payroll')
@ApiBearerAuth()
@Controller('hr')
export class HrPayrollController {
  constructor(
    private readonly hrPayroll: HrPayrollService,
    private readonly securityContext: SecurityContextService,
  ) {}

  // ---- Salary structures ----

  @Post('salary-structures')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Create a salary structure', description: 'code must be unique within the entity. basicSalary must be positive.' })
  createSalaryStructure(@Body() body: Parameters<HrPayrollService['createSalaryStructure']>[0]) {
    return this.hrPayroll.createSalaryStructure(body);
  }

  @Get('salary-structures')
  @RequirePermissions('hr.view')
  @MaskFields({
    group: 'salary',
    fields: ['basicSalary', 'housingAllowance', 'transportAllowance', 'otherAllowances'],
  })
  @ApiOperation({ summary: 'List salary structures', description: 'entityId is an optional filter on top of RLS entity scoping. Salary component fields are masked for callers without the matching unmask permission.' })
  async findSalaryStructures(@Query('entityId') entityId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.hrPayroll.findSalaryStructures(entityId, await this.securityContext.buildScope(user));
  }

  // ---- Employees ----

  @Post('employees')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Create an employee master record', description: 'employeeCode must be unique within the entity.' })
  createEmployee(@Body() body: Parameters<HrPayrollService['createEmployee']>[0]) {
    return this.hrPayroll.createEmployee(body);
  }

  @Get('employees')
  @RequirePermissions('hr.view')
  @MaskFields(
    { group: 'bankDetails', fields: ['bankName', 'bankAccountNumber'] },
    { group: 'taxId', fields: ['taxId', 'pensionPin'] },
  )
  @ApiOperation({ summary: 'List active employees', description: 'entityId is an optional filter on top of RLS entity/department scoping. Bank details and tax/pension ids are each masked separately for callers without the matching unmask permission.' })
  async findEmployees(@Query('entityId') entityId: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.hrPayroll.findEmployees(entityId, await this.securityContext.buildScope(user));
  }

  // ---- Payroll runs ----

  // Release O — Entity-Level Security: previously any payroll.manage
  // holder could create a payroll run against any entity.
  @Post('payroll-runs')
  @RequirePermissions('payroll.manage')
  @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
  @ApiOperation({ summary: 'Create a payroll run for a pay period', description: 'One run per (entityId, payPeriodName) — rejected with a 409 on a duplicate. Starts DRAFT.' })
  createPayrollRun(
    @Body() body: { entityId: string; payPeriodName: string; payPeriodStart: string; payPeriodEnd: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hrPayroll.createPayrollRun(
      body.entityId,
      body.payPeriodName,
      body.payPeriodStart,
      body.payPeriodEnd,
      user.id,
    );
  }
  @Get('payroll-runs')
  @RequirePermissions('payroll.manage')
  @ApiOperation({
    summary: 'List payroll runs',
    description: 'Lists payroll runs for the requested entity, scoped to the caller.',
  })
  async listPayrollRuns(
    @Query('entityId') entityId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hrPayroll.listPayrollRuns(
      entityId,
      await this.securityContext.buildScope(user),
    );
  }

  @Get('payroll-runs/:id')
  @RequirePermissions('payroll.manage')
  @ApiOperation({
    summary: 'Get one payroll run',
    description: 'Returns the payroll run and its payslips.',
  })
  async getPayrollRun(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hrPayroll.getPayrollRun(
      id,
      await this.securityContext.buildScope(user),
    );
  }

  @Post('payroll-runs/:id/calculate')
  @RequirePermissions('payroll.manage')
  @ApiOperation({
    summary: 'Calculate payslips for a DRAFT payroll run',
    description: 'One payslip per active employee in the run\'s own entity who has a salary structure assigned. Rejected with a 409 if the run isn\'t DRAFT, or a 400 if no eligible employee exists. Safe to re-run while still DRAFT — payslips are upserted, not duplicated. Advances the run to CALCULATED.',
  })
  calculatePayrollRun(@Param('id') id: string) {
    return this.hrPayroll.calculatePayrollRun(id);
  }

  @Post('payroll-runs/:id/approve')
  @RequirePermissions('payroll.approve')
  @ApiOperation({ summary: 'Approve a CALCULATED payroll run', description: 'Rejected with a 409 if the run isn\'t currently CALCULATED. Advances the run to APPROVED.' })
  approvePayrollRun(@Param('id') id: string) {
    return this.hrPayroll.approvePayrollRun(id);
  }

  @Post('payroll-runs/:id/post')
  @RequirePermissions('payroll.post')
  @ApiOperation({
    summary: 'Post an APPROVED payroll run to the general ledger',
    description: 'Rejected with a 409 if the run isn\'t APPROVED, or a 400 if it has no payslips. Requires the six statutory/payable GL account ids as body fields (otherDeductionsPayableGlId is only required if the run actually has other-deduction amounts to post). Advances the run to POSTED and records the created journal entry\'s own id on the run.',
  })
  postPayrollRun(
    @Param('id') id: string,
    @Body() body: Omit<Parameters<HrPayrollService['postPayrollRun']>[0], 'payrollRunId' | 'systemUserId'>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hrPayroll.postPayrollRun({ ...body, payrollRunId: id, systemUserId: user.id });
  }
}
