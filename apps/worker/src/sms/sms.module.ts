import { Module } from '@nestjs/common';
import { TwilioSmsService } from './twilio-sms.service';

@Module({
  providers: [TwilioSmsService],
  exports: [TwilioSmsService],
})
export class SmsModule {}
