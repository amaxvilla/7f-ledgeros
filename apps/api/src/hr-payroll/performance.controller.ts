import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PerformanceService } from './performance.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Performance management: a fixed cycle status chain (OPEN ->
 * CALIBRATION -> CLOSED, each transition individually guarded — close
 * additionally refuses while any review in the cycle is still short of
 * COMPLETED), Goals/OKRs (progress percent alone drives status —
 * 0/1-99/100 map to NOT_STARTED/IN_PROGRESS/COMPLETED, never set
 * directly), KPIs, a Competency catalog with per-employee assessments,
 * and a five-stage Review flow (self-assessment -> manager review ->
 * peer feedback -> calibration -> completion, each stage's own route
 * requiring the previous one's own output to already be present rather
 * than just the record to exist).
 */
@ApiTags('hr-performance')
@ApiBearerAuth()
@Controller('hr/performance')
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  // ---- Cycles ----

  @Post('cycles')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Create a performance cycle',
    description: 'Starts OPEN. The (entityId, name) pair must be unique — reusing a name for the same entity is rejected rather than creating a second cycle with the same label.',
  })
  createCycle(@Body() body: Parameters<PerformanceService['createCycle']>[0]) {
    return this.performance.createCycle(body);
  }

  @Get('cycles')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'List performance cycles',
    description: 'Optionally filtered to one entityId, newest start date first.',
  })
  findCycles(@Query('entityId') entityId?: string) {
    return this.performance.findCycles(entityId);
  }

  @Post('cycles/:id/start-calibration')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Move a cycle into calibration',
    description: 'Only an OPEN cycle can start calibration. From here, reviews in this cycle are expected to move through peer feedback and calibration rather than further self/manager edits.',
  })
  startCalibration(@Param('id') id: string) {
    return this.performance.startCalibration(id);
  }

  @Post('cycles/:id/close')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Close a performance cycle',
    description: 'Only a CALIBRATION cycle can be closed, and only once every review in it has reached COMPLETED — closing with any review still short of that is rejected, naming how many are outstanding.',
  })
  closeCycle(@Param('id') id: string) {
    return this.performance.closeCycle(id);
  }

  // ---- Goals ----

  @Post('goals')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Create a goal (OKR) for an employee',
    description: 'Starts NOT_STARTED. cycleId is optional — a goal can exist outside any specific performance cycle.',
  })
  createGoal(@Body() body: Parameters<PerformanceService['createGoal']>[0]) {
    return this.performance.createGoal(body);
  }

  @Post('goals/:id/progress')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: "Update a goal's progress",
    description: 'progressPercent must be 0-100. Status is derived automatically from the value, not set directly: 0 stays NOT_STARTED, 1-99 becomes IN_PROGRESS, 100 becomes COMPLETED.',
  })
  updateGoalProgress(@Param('id') id: string, @Body('progressPercent') progressPercent: number) {
    return this.performance.updateGoalProgress(id, progressPercent);
  }

  @Get('goals/:employeeId')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: "List an employee's goals",
    description: 'Optionally filtered to one cycleId.',
  })
  findGoals(@Param('employeeId') employeeId: string, @Query('cycleId') cycleId?: string) {
    return this.performance.findGoals(employeeId, cycleId);
  }

  // ---- KPIs ----

  @Post('kpis')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Create a KPI for an employee',
    description: 'weight defaults to 0 when omitted.',
  })
  createKpi(@Body() body: Parameters<PerformanceService['createKpi']>[0]) {
    return this.performance.createKpi(body);
  }

  @Post('kpis/:id/actual')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: "Record a KPI's actual value",
    description: 'Overwrites actualValue directly — no history of prior values is kept.',
  })
  updateKpiActual(@Param('id') id: string, @Body('actualValue') actualValue: number) {
    return this.performance.updateKpiActual(id, actualValue);
  }

  @Get('kpis/:employeeId')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: "List an employee's KPIs",
    description: 'Optionally filtered to one cycleId.',
  })
  findKpis(@Param('employeeId') employeeId: string, @Query('cycleId') cycleId?: string) {
    return this.performance.findKpis(employeeId, cycleId);
  }

  // ---- Competencies ----

  @Post('competencies')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Create a competency catalog entry',
    description: 'A shared, entity-wide competency (e.g. "Communication") that any employee can later be assessed against — not itself tied to one employee.',
  })
  createCompetency(@Body('name') name: string, @Body('description') description?: string) {
    return this.performance.createCompetency(name, description);
  }

  @Get('competencies')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'List the competency catalog',
    description: 'Every competency on record, unfiltered.',
  })
  findCompetencies() {
    return this.performance.findCompetencies();
  }

  @Post('competency-assessments')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Assess an employee against a competency',
    description: 'rating must be between 1 and 5. cycleId is optional — an assessment can be recorded outside any specific performance cycle.',
  })
  assessCompetency(@Body() body: Parameters<PerformanceService['assessCompetency']>[0], @CurrentUser() user: AuthenticatedUser) {
    return this.performance.assessCompetency(body, user.id);
  }

  @Get('competency-assessments/:employeeId')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: "List an employee's competency assessments",
    description: "Each includes its own competency record. Optionally filtered to one cycleId.",
  })
  findCompetencyAssessments(@Param('employeeId') employeeId: string, @Query('cycleId') cycleId?: string) {
    return this.performance.findCompetencyAssessments(employeeId, cycleId);
  }

  // ---- Reviews ----

  @Post('reviews/self-assessment')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Submit a self-assessment',
    description: 'selfRating must be between 1 and 5. Upserts by (employeeId, cycleId) — resubmitting for the same employee/cycle updates the existing review rather than creating a second one. Creating one for the first time auto-assigns the reviewer as the employee\'s own manager (reportsToId) — an employee with no manager set cannot submit one.',
  })
  submitSelfAssessment(@Body() body: Parameters<PerformanceService['submitSelfAssessment']>[0]) {
    return this.performance.submitSelfAssessment(body);
  }

  @Post('reviews/:id/manager-review')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Submit the manager review for an existing review',
    description: 'managerRating must be between 1 and 5. The review must already exist (created via the self-assessment route) — this only updates it, it does not create one.',
  })
  submitManagerReview(@Param('id') id: string, @Body() body: Parameters<PerformanceService['submitManagerReview']>[1]) {
    return this.performance.submitManagerReview(id, body);
  }

  @Post('reviews/:id/peer-feedback')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'Add peer feedback to a review',
    description: 'Appends to any existing peer comments (separated by "---") rather than overwriting them — this route can be called more than once per review, each call adding another peer\'s comments.',
  })
  addPeerFeedback(@Param('id') id: string, @Body('comments') comments: string) {
    return this.performance.addPeerFeedback(id, comments);
  }

  @Post('reviews/:id/calibrate')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Set the calibrated rating for a review',
    description: 'calibratedRating must be between 1 and 5, and the manager review must already be submitted — calibrating before that is rejected. The calibrated rating is the final agreed rating and may differ from the raw manager rating.',
  })
  calibrateReview(@Param('id') id: string, @Body('calibratedRating') calibratedRating: number) {
    return this.performance.calibrateReview(id, calibratedRating);
  }

  @Post('reviews/:id/complete')
  @RequirePermissions('hr.manage')
  @ApiOperation({
    summary: 'Mark a review COMPLETED',
    description: 'The review must already have a calibrated rating — completing one before calibration is rejected.',
  })
  completeReview(@Param('id') id: string) {
    return this.performance.completeReview(id);
  }

  @Get('reviews')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'List reviews',
    description: 'Optionally filtered to one employeeId and/or one cycleId, newest first.',
  })
  findReviews(@Query('employeeId') employeeId?: string, @Query('cycleId') cycleId?: string) {
    return this.performance.findReviews(employeeId, cycleId);
  }

  @Get('reviews/history/:employeeId')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: "Get an employee's completed review history",
    description: 'Every COMPLETED review for this employee across every cycle, each with its own cycle record included, newest completion first.',
  })
  findPerformanceHistory(@Param('employeeId') employeeId: string) {
    return this.performance.findPerformanceHistory(employeeId);
  }
}
