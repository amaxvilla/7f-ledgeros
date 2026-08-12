import { IsOptional, IsPhoneNumber, IsString, MaxLength } from 'class-validator';

export class SendSmsDto {
  @IsPhoneNumber(undefined, { message: 'to must be a valid phone number in E.164 format, e.g. +15551234567' })
  to!: string;

  @IsString()
  @MaxLength(1600) // Twilio's own hard cap for a single (concatenated) SMS send
  body!: string;

  /** Correlates this send back to an existing Notification row, if any — same field SmsProcessor/NotificationProcessor already use. */
  @IsOptional()
  @IsString()
  notificationId?: string;
}
