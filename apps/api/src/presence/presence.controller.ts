import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PresenceService } from './presence.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';

/** Release IG.1, Checkpoint P. */
@ApiTags('presence')
@ApiBearerAuth()
@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get()
  @ApiOperation({ summary: 'Get a user\'s presence status via the given presence provider' })
  @RequirePermissions('presence.view')
  getPresence(@Query('providerCode') providerCode: string, @Query('userIdentifier') userIdentifier: string) {
    return this.presence.getPresence(providerCode, userIdentifier);
  }
}
