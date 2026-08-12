import { Module } from '@nestjs/common';
import { HrPayrollService } from './hr-payroll.service';
import { HrPayrollController } from './hr-payroll.controller';
import { EmployeeLifecycleService } from './employee-lifecycle.service';
import { EmployeeLifecycleController } from './employee-lifecycle.controller';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PerformanceService } from './performance.service';
import { PerformanceController } from './performance.controller';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';
import { SuccessionService } from './succession.service';
import { SuccessionController } from './succession.controller';
import { SelfServiceService } from './self-service.service';
import { SelfServiceController } from './self-service.controller';
import { HrAnalyticsService } from './hr-analytics.service';
import { HrAnalyticsController } from './hr-analytics.controller';
import { GeneralLedgerModule } from '../general-ledger/general-ledger.module';

// NOTE: Recruitment (requisitions, vacancies, candidates, interviews,
// offers, background checks) is NOT registered here. It lives in its own
// RecruitmentModule (see ../recruitment/recruitment.module.ts), which is
// the single canonical recruitment domain per the Phase B harmonisation.
// Do not re-add RecruitmentService/RecruitmentController here -- that
// would resurrect the duplicate Applicant/Candidate recruitment system
// this harmonisation removed.

@Module({
  imports: [GeneralLedgerModule],
  controllers: [
    HrPayrollController,
    EmployeeLifecycleController,
    LeaveController,
    AttendanceController,
    PerformanceController,
    TrainingController,
    SuccessionController,
    SelfServiceController,
    HrAnalyticsController,
  ],
  providers: [
    HrPayrollService,
    EmployeeLifecycleService,
    LeaveService,
    AttendanceService,
    PerformanceService,
    TrainingService,
    SuccessionService,
    SelfServiceService,
    HrAnalyticsService,
  ],
  exports: [
    HrPayrollService,
    EmployeeLifecycleService,
    LeaveService,
    AttendanceService,
    PerformanceService,
    TrainingService,
    SuccessionService,
    HrAnalyticsService,
  ],
})
export class HrPayrollModule {}
