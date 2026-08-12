import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

// The context a workflow's rules are evaluated against. Field names are
// deliberately generic (not e.g. "purchaseOrderAmount") so the same
// workflow definition works for any consuming module — Procurement,
// AP, Budgeting, or something built later.
export class WorkflowContextDto {
  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  riskLevel?: string;

  @IsOptional()
  budgetAvailable?: boolean;
}

export class StartWorkflowInstanceDto {
  @IsString()
  workflowCode!: string;

  // The domain record this instance approves — e.g. "PurchaseOrder" /
  // a PurchaseOrder.id. Loose reference, not an FK.
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsObject()
  context!: WorkflowContextDto;
}
