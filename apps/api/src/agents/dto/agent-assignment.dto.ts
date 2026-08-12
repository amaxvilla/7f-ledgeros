import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AgentAssignmentRole, AgentAssignmentScope } from '@prisma/client';

/**
 * Exactly one of projectId/unitId/allocationId must be present, matching
 * `scope` — checked by AgentAssignmentService.validateTarget(), not by a
 * class-validator decorator here (no @ValidateIf precedent elsewhere in
 * this codebase's own DTOs; cross-field validation stays in the service
 * layer, matching how Agent.displayName/contactPersonName's own pairing
 * is already handled).
 *
 * `entityId` is required here (unlike a lookup-by-existing-row endpoint)
 * so `@RlsBodyCheck` can verify access before the handler runs — see
 * AgentAssignment.entityId's own schema comment for why the service
 * still cross-validates it against the target's real structural entity
 * rather than trusting it outright.
 */
export class CreateAgentAssignmentDto {
  @IsString()
  agentId!: string;

  @IsString()
  entityId!: string;

  @IsEnum(AgentAssignmentScope)
  scope!: AgentAssignmentScope;

  @IsEnum(AgentAssignmentRole)
  role!: AgentAssignmentRole;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  unitId?: string;

  @IsOptional()
  @IsString()
  allocationId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class EndAgentAssignmentDto {
  @IsString()
  reason!: string;
}
