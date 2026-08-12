import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MicrosoftGraphMailService } from './microsoft-graph-mail.service';
import { GmailMailService } from './gmail-mail.service';

@Module({
  providers: [MailService, MicrosoftGraphMailService, GmailMailService],
  exports: [MailService, MicrosoftGraphMailService, GmailMailService],
})
export class MailModule {}
