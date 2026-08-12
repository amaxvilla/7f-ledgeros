import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

/** Release IE.1, Checkpoint D. Mirrors RefundPaymentParams (payment-provider.interface.ts) minus `reference`, which comes from the URL param instead. */
export class RefundPaymentDto {
  /** Omit for a full refund. */
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
