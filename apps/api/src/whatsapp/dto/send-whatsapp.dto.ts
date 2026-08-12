import { IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class SendWhatsAppDto {
  @IsPhoneNumber(undefined, { message: 'to must be a valid phone number in E.164 format, e.g. +15551234567' })
  to!: string;

  @IsString()
  @MaxLength(4096) // WhatsApp Cloud API's documented cap for a text message body
  body!: string;

  /** Correlates this send back to an existing Notification row, if any — same field WhatsAppProcessor/NotificationProcessor already use. */
  @IsOptional()
  @IsString()
  notificationId?: string;
}
