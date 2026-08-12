import { Module } from '@nestjs/common';
import { CommissionPlanService } from './commission-plan.service';
import { CommissionPlanController } from './commission-plan.controller';
import { CommissionCalculationService } from './commission-calculation.service';
import { CommissionCalculationController } from './commission-calculation.controller';
import { CommissionReportingService } from './commission-reporting.service';
import { CommissionReportingController } from './commission-reporting.controller';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';

/**
 * Agent & Commission Management, RE-COMM.1 (Commission Plans) +
 * RE-COMM.2 (Commission Calculation) + RE-COMM.3 (Lifecycle) +
 * RE-COMM.4 (Financial Integration) + RE-COMM.5 (Agent Statements &
 * Reporting). PrismaModule/SecurityModule are both @Global(), so
 * neither is imported here explicitly — matching AgentModule's own
 * precedent. GeneralLedgerModule is imported (not global) so
 * CommissionCalculationService can inject PostingEngineService — the
 * same wiring AccountsPayableModule's own precedent already
 * established. CommissionCalculationService depends on
 * CommissionPlanService directly (constructor injection, both
 * providers of this same module) to reuse resolvePlan() rather than
 * re-implement plan resolution. CommissionReportingService lives in
 * this same module (not a separate one) the same way AgentModule holds
 * both RE-AGENT.1 and RE-AGENT.2 — it only reads, has no dependency on
 * CommissionCalculationService itself (goes straight to Prisma, same
 * "reporting queries its own domain's tables directly" posture
 * DashboardService's own per-domain aggregations already take), so no
 * extra provider wiring beyond registering it here.
 */
@Module({
  imports: [GeneralLedgerModule],
  controllers: [CommissionPlanController, CommissionCalculationController, CommissionReportingController],
  providers: [CommissionPlanService, CommissionCalculationService, CommissionReportingService],
  exports: [CommissionPlanService, CommissionCalculationService, CommissionReportingService],
})
export class CommissionModule {}
