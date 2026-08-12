import { IsEnum, IsOptional, IsString } from 'class-validator';
import { WorkflowActionType } from '@prisma/client';

export class ActOnWorkflowDto {
  @IsEnum(WorkflowActionType)
  action!: WorkflowActionType;

  @IsOptional()
  @IsString()
  comments?: string;
}
