import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SmsService } from './sms.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { SendSmsDto } from './dto/send-sms.dto';

@ApiTags('sms')
@ApiBearerAuth()
@Controller('sms')
export class SmsController {
  constructor(private readonly sms: SmsService) {}

  @Post('send')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: 'Send an SMS message',
    description: 'Asynchronous — enqueues the message onto the worker queue and returns immediately (queued: true); this does not wait for the provider to actually deliver it.',
  })
  send(@Body() dto: SendSmsDto) {
    return this.sms.sendSms(dto);
  }
}
