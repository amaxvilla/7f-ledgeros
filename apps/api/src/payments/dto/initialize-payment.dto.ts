import { IsEmail, IsInt, IsObject, IsOptional, IsString, IsUrl, Matches, Min, MaxLength } from 'class-validator';

/**
 * Release IE.1, Checkpoint D. Mirrors InitializePaymentParams
 * (payment-provider.interface.ts) field-for-field, plus the two fields
 * that interface deliberately leaves to the caller of a *provider*
 * rather than the provider itself: entityId (RLS scoping — a provider
 * has no concept of "entity") and providerCode (which registered
 * provider to route to — a provider doesn't know its own registry key).
 */
export class InitializePaymentDto {
  @IsString()
  entityId!: string;

  /** Registry lookup key, e.g. "PAYSTACK" — see PaymentProviderRegistry. */
  @IsString()
  providerCode!: string;

  /** Caller-supplied, must be idempotent — the same reference passed twice must not create two charges. */
  @IsString()
  @MaxLength(200)
  reference!: string;

  /** Integer, minor currency unit (e.g. kobo, cents) — never a float major-unit amount. */
  @IsInt()
  @Min(1)
  amount!: number;

  /** ISO 4217 currency code, e.g. "NGN", "USD" — not restricted to a fixed list, since this framework is provider-agnostic and different deployments will support different currencies. */
  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO 4217 code, e.g. NGN, USD' })
  currency!: string;

  @IsEmail()
  customerEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  callbackUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
