import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { WorkflowRuleField, WorkflowRuleOperator, WorkflowStageType } from '@prisma/client';

export class CreateStageRuleDto {
  @IsEnum(WorkflowRuleField)
  field!: WorkflowRuleField;

  @IsEnum(WorkflowRuleOperator)
  operator!: WorkflowRuleOperator;

  // JSON-encoded: a number for AMOUNT, a string for
  // DEPARTMENT/PROJECT/ENTITY/ROLE/RISK_LEVEL, a boolean for
  // BUDGET_AVAILABILITY, or a JSON array for the IN operator.
  @IsString()
  value!: string;

  @IsOptional()
  @IsString()
  requiredRoleCode?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// A rule that decides whether a whole stage applies at all for a given
// instance context (e.g. "skip the CFO stage unless AMOUNT GT 10m").
export class CreateWorkflowRuleDto extends CreateStageRuleDto {
  @IsInt()
  @Min(1)
  appliesToStageSequence!: number;
}

export class CreateStageDto {
  @IsInt()
  @Min(1)
  sequence!: number;

  @IsString()
  name!: string;

  @IsEnum(WorkflowStageType)
  stageType!: WorkflowStageType;

  @IsOptional()
  @IsString()
  requiredRoleCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  minApprovals?: number;

  // Rules attached directly to this stage (stageDefinitionId is
  // inferred). Rules with no stage (workflow-level "skip this stage
  // unless...") go in CreateWorkflowDefinitionDto.workflowRules instead.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateStageRuleDto)
  rules?: CreateStageRuleDto[];
}

export class CreateWorkflowDefinitionDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  entityType!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'A workflow needs at least one stage' })
  @ValidateNested({ each: true })
  @Type(() => CreateStageDto)
  stages!: CreateStageDto[];

  // Workflow-level rules: which stages (by sequence number) apply at
  // all for a given instance context. A stage with no matching rule
  // here always applies.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowRuleDto)
  workflowRules?: CreateWorkflowRuleDto[];
}

