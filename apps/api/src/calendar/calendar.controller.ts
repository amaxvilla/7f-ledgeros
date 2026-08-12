import { Body, Controller, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CalendarService } from './calendar.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CreateCalendarEventDto, UpdateCalendarEventDto, CancelCalendarEventDto } from './dto/calendar-event.dto';

/** Release IG.1, Checkpoint C. */
@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar/events')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a calendar event via the given calendar provider',
    description: 'A thin call-through to the provider registry -- no Prisma persistence, no opinion on which of this codebase\'s events should sync to a provider calendar.',
  })
  @RequirePermissions('calendar.manage')
  create(@Body() dto: CreateCalendarEventDto) {
    return this.calendar.createEvent(dto);
  }

  @Post(':providerEventId')
  @ApiOperation({ summary: 'Update a calendar event via the given calendar provider' })
  @RequirePermissions('calendar.manage')
  update(@Param('providerEventId') providerEventId: string, @Body() dto: UpdateCalendarEventDto) {
    return this.calendar.updateEvent(providerEventId, dto);
  }

  @Post(':providerEventId/cancel')
  @ApiOperation({ summary: 'Cancel a calendar event via the given calendar provider' })
  @RequirePermissions('calendar.manage')
  cancel(@Param('providerEventId') providerEventId: string, @Body() dto: CancelCalendarEventDto) {
    return this.calendar.cancelEvent(providerEventId, dto);
  }
}
