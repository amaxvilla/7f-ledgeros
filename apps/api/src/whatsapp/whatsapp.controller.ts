import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { SendWhatsAppDto } from './dto/send-whatsapp.dto';

@ApiTags('whatsapp')
@ApiBearerAuth()
@Controller('whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  @Post('send')
  @RequirePermissions('integrations.manage')
  @ApiOperation({
    summary: 'Send a WhatsApp message',
    description: 'Asynchronous — enqueues the message onto the worker queue and returns immediately (queued: true); this does not wait for the provider to actually deliver it.',
  })
  send(@Body() dto: SendWhatsAppDto) {
    return this.whatsapp.sendWhatsApp(dto);
  }
}
