import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { AgentType } from '@prisma/client';

export class CreateAgentDto {
  @IsString()
  entityId!: string;

  @IsEnum(AgentType)
  agentType!: AgentType;

  /** Caller-supplied, must be unique — same convention as Vendor.code/Customer.code elsewhere in this codebase. */
  @IsString()
  code!: string;

  @IsString()
  displayName!: string;

  /** The person to reach at a COMPANY/BROKER agent — see Agent.contactPersonName's own schema comment. */
  @IsOptional()
  @IsString()
  contactPersonName?: string;

  @IsString()
  email!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  licenseIssuingBody?: string;

  @IsOptional()
  @IsDateString()
  licenseExpiryDate?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankSwiftCode?: string;

  @IsOptional()
  @IsString()
  taxIdentificationNumber?: string;

  @IsOptional()
  @IsBoolean()
  withholdingTaxExempt?: boolean;

  @IsOptional()
  @IsString()
  agreementReference?: string;

  @IsOptional()
  @IsDateString()
  agreementStartDate?: string;

  @IsOptional()
  @IsDateString()
  agreementEndDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Deliberately excludes `status`, `code`, `entityId`, and every
 * approved/suspended/terminated-by-whom column. `status` moves only
 * through AgentService's own guarded transition methods (approve/
 * suspend/reactivate/terminate) — see AgentStatus's own schema doc
 * comment for why arbitrary status manipulation via a general update
 * endpoint is not allowed. `code`/`entityId` are treated as immutable
 * identity, same as Vendor/Customer's own `code` elsewhere.
 */
export class UpdateAgentDto {
  @IsOptional()
  @IsEnum(AgentType)
  agentType?: AgentType;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  contactPersonName?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsString()
  licenseIssuingBody?: string;

  @IsOptional()
  @IsDateString()
  licenseExpiryDate?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankSwiftCode?: string;

  @IsOptional()
  @IsString()
  taxIdentificationNumber?: string;

  @IsOptional()
  @IsBoolean()
  withholdingTaxExempt?: boolean;

  @IsOptional()
  @IsString()
  agreementReference?: string;

  @IsOptional()
  @IsDateString()
  agreementStartDate?: string;

  @IsOptional()
  @IsDateString()
  agreementEndDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SuspendAgentDto {
  @IsString()
  reason!: string;
}

export class TerminateAgentDto {
  @IsString()
  reason!: string;
}
