import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ManualSignatureStatus } from '@prisma/client';

export class SignerDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;
}

export class VoidEnvelopeDto {
  /** Which registered SignatureProvider to use (e.g. "DOCUSIGN", "ADOBE_SIGN", "GENERIC_SIGNATURE") — see SignatureProviderRegistry. */
  @IsString()
  providerCode!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class GetSignatureStatusQueryDto {
  @IsString()
  providerCode!: string;
}

export class DownloadSignedDocumentQueryDto {
  @IsString()
  providerCode!: string;
}

/**
 * Digital Signature Providers, Checkpoint L — the register-list query
 * ManualSignatureService/SignaturesController were missing (flagged
 * across several Frontend Completion checkpoints' own reports as the
 * thing blocking a signatures page: only findOne(id) existed, no way to
 * discover which ids exist at all). Optional `status` filter only —
 * ManualSignatureEnvelope has no entityId/dimension field to filter or
 * RLS-scope by (see that model's own schema comment; Checkpoint H's
 * provider has no external vendor and therefore no natural entity
 * owner), so unlike most other list endpoints in this codebase this one
 * has no entityId query param to accept.
 */
export class ListManualSignatureEnvelopesQueryDto {
  @IsOptional()
  @IsEnum(ManualSignatureStatus)
  status?: ManualSignatureStatus;
}
