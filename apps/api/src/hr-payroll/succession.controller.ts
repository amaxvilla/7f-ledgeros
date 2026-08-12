import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuccessionCriticality, SuccessionReadiness } from '@prisma/client';
import { SuccessionService } from './succession.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/**
 * Succession planning: a named position ("plan"), its current incumbent,
 * and a pool of candidates each with their own readiness rating. Two
 * derived views sit alongside the plain CRUD: findHighPotentials (every
 * candidate flagged isHighPotential, across every plan) and
 * findCoverageGaps (HIGH/CRITICAL-criticality plans with no candidate
 * yet rated READY_NOW) — both read-only rollups over the same
 * SuccessionCandidate/SuccessionPlan data the create/list routes above
 * them already expose, not their own separately-maintained table.
 */
@ApiTags('hr-succession')
@ApiBearerAuth()
@Controller('hr/succession')
export class SuccessionController {
  constructor(private readonly succession: SuccessionService) {}

  @Post('plans')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Create a succession plan for a position' })
  createPlan(@Body() body: Parameters<SuccessionService['createPlan']>[0]) {
    return this.succession.createPlan(body);
  }

  @Get('plans')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'List succession plans', description: 'entityId and criticality are both optional filters.' })
  findPlans(@Query('entityId') entityId?: string, @Query('criticality') criticality?: SuccessionCriticality) {
    return this.succession.findPlans(entityId, criticality);
  }

  @Post('candidates')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Add a candidate to a succession plan', description: 'Rejected with a 409 if this employee is already mapped as a candidate for this plan.' })
  addCandidate(@Body() body: Parameters<SuccessionService['addCandidate']>[0]) {
    return this.succession.addCandidate(body);
  }

  @Post('candidates/:id/readiness')
  @RequirePermissions('hr.manage')
  @ApiOperation({ summary: 'Update a candidate\'s readiness rating and development notes' })
  updateReadiness(
    @Param('id') id: string,
    @Body('readiness') readiness: SuccessionReadiness,
    @Body('developmentNotes') developmentNotes?: string,
  ) {
    return this.succession.updateReadiness(id, readiness, developmentNotes);
  }

  @Get('high-potentials')
  @RequirePermissions('hr.view')
  @ApiOperation({ summary: 'List every candidate flagged as high-potential, across every succession plan' })
  findHighPotentials(@Query('entityId') entityId?: string) {
    return this.succession.findHighPotentials(entityId);
  }

  @Get('coverage-gaps')
  @RequirePermissions('hr.view')
  @ApiOperation({
    summary: 'List HIGH/CRITICAL-criticality plans with no candidate yet rated READY_NOW',
    description: 'The leadership-risk view: a plan appears here only if its criticality is HIGH or CRITICAL AND none of its candidates has readiness=READY_NOW yet.',
  })
  findCoverageGaps(@Query('entityId') entityId: string) {
    return this.succession.findCoverageGaps(entityId);
  }
}
