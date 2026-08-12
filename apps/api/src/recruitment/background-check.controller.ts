import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { BackgroundCheckService } from './background-check.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';

@ApiTags('recruitment-background-checks')
@ApiBearerAuth()
@Controller('recruitment/background-checks')
export class BackgroundCheckController {
  constructor(private readonly backgroundChecks: BackgroundCheckService) {}

  @Post()
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Start a background check for an application',
    description:
      "Creates one IN_PROGRESS background check for the given jobApplicationId — at most one per application; a second call for the same application is rejected with a conflict rather than starting a duplicate. CandidateService.hire() later gates on this check's own status, so starting one is a prerequisite for hiring, not an optional record.",
  })
  start(
    @Body() body: Parameters<BackgroundCheckService['start']>[0],
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.backgroundChecks.start(body, user.id);
  }

  @Patch(':id/complete')
  @RequirePermissions('recruitment.manage')
  @ApiOperation({
    summary: 'Record a background check result',
    description:
      'Sets the check to CLEARED or FLAGGED depending on cleared, stamps completedAt, and stores the optional notes. There is no way to move a completed check back to IN_PROGRESS — this is a one-way transition.',
  })
  complete(@Param('id') id: string, @Body() body: { cleared: boolean; notes?: string }) {
    return this.backgroundChecks.complete(id, body.cleared, body.notes);
  }

  @Get('by-application')
  @RequirePermissions('recruitment.view')
  @ApiOperation({
    summary: "Get an application's background check",
    description: 'Returns the single background check for the given jobApplicationId, or null if none has been started yet.',
  })
  findForApplication(@Query('jobApplicationId') jobApplicationId: string) {
    return this.backgroundChecks.findForApplication(jobApplicationId);
  }
}
