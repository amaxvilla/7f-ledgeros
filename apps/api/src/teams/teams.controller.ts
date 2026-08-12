import { Body, Controller, Delete, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateMeetingDto, CancelMeetingDto } from './dto/teams.dto';

/** Release IG.1, Checkpoint S. */
@ApiTags('teams')
@ApiBearerAuth()
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post('meetings')
  @ApiOperation({
    summary: 'Create a Teams meeting via the given provider',
    description:
      'A thin call-through to the provider registry -- no Prisma persistence, no opinion on which of this codebase\'s own flows (most likely a remote-interview scheduling flow) should trigger creating one; that wiring is deferred to its own later checkpoint. startTime/endTime arrive as ISO strings and are converted to real Dates before reaching the provider.',
  })
  @RequirePermissions('teams.manage')
  create(@Body() dto: CreateMeetingDto) {
    return this.teams.createMeeting(dto);
  }

  @Delete('meetings/:providerMeetingId')
  @ApiOperation({ summary: 'Cancel a Teams meeting via the given provider' })
  @RequirePermissions('teams.manage')
  cancel(@Param('providerMeetingId') providerMeetingId: string, @Body() dto: CancelMeetingDto) {
    return this.teams.cancelMeeting(providerMeetingId, dto);
  }
}
