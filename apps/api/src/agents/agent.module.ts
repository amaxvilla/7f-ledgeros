import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { AgentAssignmentService } from './agent-assignment.service';
import { AgentAssignmentController } from './agent-assignment.controller';

/**
 * Agent Management, RE-AGENT.1 (Agent Master) + RE-AGENT.2 (Agent
 * Assignment) — both live in one module since assignment has no
 * meaning without an agent to assign. PrismaModule/SecurityModule are
 * both @Global() (see their own doc comments), so neither is imported
 * here explicitly, matching how ApiGatewayModule/CrmModule handle the
 * same dependencies.
 */
@Module({
  controllers: [AgentController, AgentAssignmentController],
  providers: [AgentService, AgentAssignmentService],
  exports: [AgentService, AgentAssignmentService],
})
export class AgentModule {}
