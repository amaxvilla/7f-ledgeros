import { IsOptional, IsString } from 'class-validator';

export class RequisitionDecisionDto {
  @IsOptional()
  @IsString()
  comments?: string;
}
