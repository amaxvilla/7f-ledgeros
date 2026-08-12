import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * HR — Employee Lifecycle: profile, documents/next-of-kin/emergency
 * contacts, onboarding, asset assignment, disciplinary cases, and exit
 * & clearance. Every write body here is a plain interface type inferred
 * via `Parameters<EmployeeLifecycleService['x']>[0]` (confirmed directly
 * against the service file) rather than a class-validated DTO — no
 * `class-validator` decorators run against any of these request bodies.
 */
@ApiTags('hr-employee-lifecycle')
@ApiBearerAuth()
@Controller('hr/employees')
export class EmployeeLifecycleController {
  constructor(private readonly lifecycle: EmployeeLifecycleService) {}

  // ---- Profile ----

  @Get(':id')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Get an employee profile',
    description:
      "Includes department, salary structure, manager/direct-reports (id/name/jobTitle only), documents, next of kin, emergency contacts, asset assignments, onboarding tasks, and the exit record (with its own clearance items) if one exists.",
  })
  findOne(@Param('id') id: string) {
    return this.lifecycle.findOneEmployee(id);
  }

  @Patch(':id')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Update an employee profile',
    description: 'Rejects setting reportsToId to the employee\'s own id (an employee cannot report to themselves).',
  })
  updateProfile(@Param('id') id: string, @Body() body: Parameters<EmployeeLifecycleService['updateProfile']>[1]) {
    return this.lifecycle.updateProfile(id, body);
  }

  @Post(':id/confirm')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Confirm an employee out of probation',
    description: 'Only valid while the employee is currently PROBATION — a discrete, auditable event, not implied by any other update.',
  })
  confirm(@Param('id') id: string) {
    return this.lifecycle.confirmEmployee(id);
  }

  @Post('employment-events')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Log a transfer / promotion / demotion / secondment / contract-renewal event',
    description:
      "Applies the event's own \"to\" values (department/job title/grade level) onto the Employee record in the same transaction as logging it, so the employment-history list is always an accurate record of what actually changed, not just a separately-tracked intent. A CONFIRMATION event type also flips employmentStatus to CONFIRMED and sets confirmationDate as a side effect — the same state POST :id/confirm above sets directly.",
  })
  recordEmploymentEvent(
    @Body() body: Parameters<EmployeeLifecycleService['recordEmploymentEvent']>[0],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lifecycle.recordEmploymentEvent(body, user.id);
  }

  @Get(':id/employment-history')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: "List an employee's own employment-event history, most recent first" })
  findEmploymentHistory(@Param('id') id: string) {
    return this.lifecycle.findEmploymentHistory(id);
  }

  @Get('org-chart')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: "Get an entity's flat org-chart edge list",
    description: 'Active employees only (id/name/jobTitle/departmentId/reportsToId) — the caller reconstructs the tree from these edges; nothing pre-nested is returned.',
  })
  organizationChart(@Query('entityId') entityId: string) {
    return this.lifecycle.organizationChart(entityId);
  }

  // ---- Documents / next of kin / emergency contacts ----

  @Post('documents')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Attach a document to an employee' })
  addDocument(@Body() body: Parameters<EmployeeLifecycleService['addDocument']>[0], @CurrentUser() user: AuthenticatedUser) {
    return this.lifecycle.addDocument(body, user.id);
  }

  @Post('next-of-kin')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: "Record an employee's next of kin" })
  addNextOfKin(@Body() body: Parameters<EmployeeLifecycleService['addNextOfKin']>[0]) {
    return this.lifecycle.addNextOfKin(body);
  }

  @Post('emergency-contacts')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: "Record an employee's emergency contact" })
  addEmergencyContact(@Body() body: Parameters<EmployeeLifecycleService['addEmergencyContact']>[0]) {
    return this.lifecycle.addEmergencyContact(body);
  }

  // ---- Onboarding ----

  @Post(':id/onboarding/start')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Seed the standard onboarding checklist for a newly hired employee',
    description:
      'Creates a fixed 7-item checklist (signed offer letter, IT provisioning, ID card, policy briefing, onboarding buddy, payroll & bank details, statutory registrations) with an optional shared due date. Rejected if the employee already has any onboarding task — this can only seed the checklist once.',
  })
  startOnboarding(@Param('id') id: string, @Query('dueDate') dueDate?: string) {
    return this.lifecycle.startOnboarding(id, dueDate);
  }

  @Post('onboarding/tasks')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Add one extra onboarding task outside the standard checklist' })
  createOnboardingTask(@Body() body: Parameters<EmployeeLifecycleService['createOnboardingTask']>[0]) {
    return this.lifecycle.createOnboardingTask(body);
  }

  @Post('onboarding/tasks/:taskId/complete')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Mark an onboarding task complete' })
  completeOnboardingTask(@Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.lifecycle.completeOnboardingTask(taskId, user.id);
  }

  @Get(':id/onboarding/tasks')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: "List an employee's onboarding tasks, ordered by due date" })
  findOnboardingTasks(@Param('id') id: string) {
    return this.lifecycle.findOnboardingTasks(id);
  }

  // ---- Asset assignment ----

  @Post('assets')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Assign a company asset to an employee' })
  assignAsset(@Body() body: Parameters<EmployeeLifecycleService['assignAsset']>[0], @CurrentUser() user: AuthenticatedUser) {
    return this.lifecycle.assignAsset(body, user.id);
  }

  @Post('assets/:assignmentId/return')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Record a company asset as returned',
    description: 'Only valid while the assignment is currently ASSIGNED — an already-returned assignment is rejected.',
  })
  returnAsset(@Param('assignmentId') assignmentId: string, @Body('condition') condition?: string) {
    return this.lifecycle.returnAsset(assignmentId, condition);
  }

  @Get(':id/assets')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'List every asset ever assigned to an employee, assigned and returned alike' })
  findAssetAssignments(@Param('id') id: string) {
    return this.lifecycle.findAssetAssignments(id);
  }

  // ---- Disciplinary ----

  @Post('disciplinary-cases')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Raise a disciplinary case against an employee' })
  raiseDisciplinaryCase(
    @Body() body: Parameters<EmployeeLifecycleService['raiseDisciplinaryCase']>[0],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lifecycle.raiseDisciplinaryCase(body, user.id);
  }

  @Post('disciplinary-cases/:caseId/close')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Close a disciplinary case with an outcome',
    description: 'Rejected if the case is already CLOSED.',
  })
  closeDisciplinaryCase(@Param('caseId') caseId: string, @Body('outcome') outcome: string) {
    return this.lifecycle.closeDisciplinaryCase(caseId, outcome);
  }

  @Get(':id/disciplinary-cases')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: "List an employee's disciplinary cases, most recently raised first" })
  findDisciplinaryCases(@Param('id') id: string) {
    return this.lifecycle.findDisciplinaryCases(id);
  }

  // ---- Exit & clearance ----

  @Post('exits')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Initiate an employee exit',
    description:
      'One exit record per employee — rejected if the employee already has one. clearanceChecklist maps department names to their own checklist item names (e.g. { IT: ["Return laptop"] }), and at least one item across all departments is required. In the same transaction, flips the employee\'s own employmentStatus to TERMINATED (exitType TERMINATION) or RESIGNED (every other exitType).',
  })
  initiateExit(@Body() body: Parameters<EmployeeLifecycleService['initiateExit']>[0], @CurrentUser() user: AuthenticatedUser) {
    return this.lifecycle.initiateExit(body, user.id);
  }

  @Post('exits/clearance-items/:itemId/clear')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Clear one item on an employee exit\'s own clearance checklist',
    description:
      'A special-cased guard: an IT-department item whose own text mentions "asset" (a plain case-insensitive substring match on the item name, not a structured flag) cannot be cleared while the employee still has any ASSIGNED asset outstanding. Automatically rolls the parent exit record\'s own overall clearanceStatus up to COMPLETED once every item on the checklist is CLEARED — that rollup is not a separate call.',
  })
  clearExitItem(
    @Param('itemId') itemId: string,
    @Body('remarks') remarks: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lifecycle.clearExitItem(itemId, user.id, remarks);
  }

  @Get(':id/exit')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: "Get an employee's exit record and its own clearance items" })
  findExitRecord(@Param('id') id: string) {
    return this.lifecycle.findExitRecord(id);
  }
}
