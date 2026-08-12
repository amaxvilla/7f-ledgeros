import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ApplicationStage,
  EmploymentType,
  InterviewStatus,
  RequisitionStatus,
  VacancyStatus,
  WorkflowInstanceStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkflowEngineService } from '../workflow/workflow.service';
import { BudgetingService } from '../budgeting/budgeting.service';
import { RowLevelSecurityService } from '../security/row-level-security.service';
import { SecurityScope } from '../security/security.types';

interface CreateRequisitionDto {
  entityId: string;
  departmentId?: string;
  costCenterId?: string;
  projectId?: string;
  jobTitle: string;
  gradeLevel?: string;
  employmentType?: EmploymentType;
  headcount?: number;
  justification?: string;
  /** Optional link into Budgeting for headcount-cost validation, ported from ZIP A. */
  budgetLineId?: string;
}

interface CreateVacancyDto {
  jobRequisitionId: string;
  title: string;
  description?: string;
  location?: string;
  employmentType?: EmploymentType;
}

/**
 * Job requisitions, vacancies, and recruitment-wide dashboards/reports.
 * Candidate pipeline, interviews, and offers live in their own services —
 * see candidate.service.ts, interview.service.ts, offer.service.ts.
 */
@Injectable()
export class RecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowEngineService,
    private readonly budgeting: BudgetingService,
    private readonly rowLevelSecurity: RowLevelSecurityService,
  ) {}

  // -------------------------------------------------------------------
  // JOB REQUISITIONS
  // -------------------------------------------------------------------

  /**
   * Fix (FC-6.2): `submitRequisitionForApproval`/`refreshRequisitionApproval`/
   * `closeRequisition`/`createVacancy` all previously called the public,
   * RLS-scoped `findOneRequisition(id, scope)` with only `id` — a real,
   * independent (non-Prisma-cascading) compile error FC-6.1's own report
   * named and left for a later checkpoint, confirmed directly (4 call
   * sites) before this fix. None of these four write/action routes have
   * (or need) a `SecurityScope` at their own call site — matching
   * `BudgetingService`'s own established, precedented split: write/action
   * routes use a private, unscoped `getXOrThrow(id)` (write authorization
   * comes from `@RequirePermissions` on the controller route, not RLS row
   * visibility), while only read routes use the public, scoped
   * `findOne(id, scope)`. `getBudgetOrThrow`'s own shape is the direct
   * precedent this helper mirrors, not a design invented for this fix.
   */
  private async getRequisitionOrThrow(id: string) {
    const req = await this.prisma.jobRequisition.findUnique({ where: { id } });
    if (!req) throw new NotFoundException(`Job requisition ${id} not found`);
    return req;
  }

  async createRequisition(dto: CreateRequisitionDto, requestedById: string) {
    if (!dto.jobTitle?.trim()) throw new BadRequestException('jobTitle is required');
    return this.prisma.jobRequisition.create({
      data: {
        entityId: dto.entityId,
        departmentId: dto.departmentId,
        costCenterId: dto.costCenterId,
        projectId: dto.projectId,
        requestedById,
        jobTitle: dto.jobTitle,
        gradeLevel: dto.gradeLevel,
        employmentType: dto.employmentType ?? EmploymentType.FULL_TIME,
        headcount: dto.headcount ?? 1,
        justification: dto.justification,
        budgetLineId: dto.budgetLineId,
        status: RequisitionStatus.DRAFT,
      },
    });
  }

  async findRequisitions(scope: SecurityScope, entityId?: string, status?: RequisitionStatus) {
    const rls = this.rowLevelSecurity.buildWhere(scope, {
      dimensions: ['entity', 'department', 'costCenter', 'project', 'businessUnit'],
    });
    return this.prisma.jobRequisition.findMany({
      where: { AND: [rls, { entityId, status }] },
      include: { vacancies: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneRequisition(id: string, scope: SecurityScope) {
    const req = await this.prisma.jobRequisition.findUnique({
      where: { id },
      include: { vacancies: true },
    });
    if (!req) throw new NotFoundException(`Job requisition ${id} not found`);
    if (
      !this.rowLevelSecurity.canAccess(
        scope,
        { entityId: req.entityId, departmentId: req.departmentId, costCenterId: req.costCenterId, projectId: req.projectId },
        { dimensions: ['entity', 'department', 'costCenter', 'project', 'businessUnit'] },
      )
    ) {
      throw new NotFoundException(`Job requisition ${id} not found`);
    }
    return req;
  }

  /**
   * Submits a DRAFT requisition into the existing Workflow Engine for
   * approval. Requires a "RECRUITMENT_REQUISITION" workflow definition to
   * have been configured; if none exists, callers get a clear error rather
   * than a silent no-op.
   *
   * If a budgetLineId was supplied (budget-linked headcount planning,
   * ported from ZIP A), the requisition can only be submitted while
   * budget remains available on that line -- this mirrors ZIP A's
   * approveRequisition check but runs it at submission time so a
   * requisition never enters the approval workflow without funding.
   */
  async submitRequisitionForApproval(id: string, userId: string) {
    const req = await this.getRequisitionOrThrow(id);
    if (req.status !== RequisitionStatus.DRAFT) {
      throw new ConflictException(`Only DRAFT requisitions can be submitted (current status: ${req.status})`);
    }

    if (req.budgetLineId) {
      const available = await this.budgeting.getAvailableForLine(req.budgetLineId);
      if (available <= 0) {
        throw new BadRequestException(`No available budget remains on the linked budget line (${available})`);
      }
    }

    const instance = await this.workflow.startInstance(
      {
        workflowCode: 'RECRUITMENT_REQUISITION',
        entityType: 'JobRequisition',
        entityId: req.id,
        context: {
          entityId: req.entityId,
          departmentId: req.departmentId ?? undefined,
          projectId: req.projectId ?? undefined,
        },
      },
      userId,
    );

    return this.prisma.jobRequisition.update({
      where: { id },
      data: { status: RequisitionStatus.PENDING_APPROVAL, workflowInstanceId: instance.id },
    });
  }

  /**
   * Reconciles requisition status with its workflow instance. Call after
   * acting on the instance via POST /workflow/instances/:id/act.
   */
  async refreshRequisitionApproval(id: string) {
    const req = await this.getRequisitionOrThrow(id);
    if (!req.workflowInstanceId) return req;

    const instance = await this.workflow.getInstance(req.workflowInstanceId);
    if (instance.status === WorkflowInstanceStatus.APPROVED && req.status !== RequisitionStatus.APPROVED) {
      return this.prisma.jobRequisition.update({
        where: { id },
        data: { status: RequisitionStatus.APPROVED, approvedAt: new Date() },
      });
    }
    if (
      (instance.status === WorkflowInstanceStatus.REJECTED || instance.status === WorkflowInstanceStatus.RETURNED) &&
      req.status !== RequisitionStatus.REJECTED
    ) {
      return this.prisma.jobRequisition.update({ where: { id }, data: { status: RequisitionStatus.REJECTED } });
    }
    return req;
  }

  async closeRequisition(id: string) {
    await this.getRequisitionOrThrow(id);
    return this.prisma.jobRequisition.update({ where: { id }, data: { status: RequisitionStatus.CLOSED } });
  }

  // -------------------------------------------------------------------
  // VACANCIES
  // -------------------------------------------------------------------

  async createVacancy(dto: CreateVacancyDto) {
    const req = await this.getRequisitionOrThrow(dto.jobRequisitionId);
    if (req.status !== RequisitionStatus.APPROVED) {
      throw new ConflictException('Vacancies can only be opened against an APPROVED requisition');
    }
    return this.prisma.vacancy.create({
      data: {
        jobRequisitionId: req.id,
        entityId: req.entityId,
        departmentId: req.departmentId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        employmentType: dto.employmentType ?? req.employmentType,
        status: VacancyStatus.DRAFT,
      },
    });
  }

  async publishVacancy(id: string) {
    const vacancy = await this.findOneVacancy(id);
    if (vacancy.status !== VacancyStatus.DRAFT && vacancy.status !== VacancyStatus.ON_HOLD) {
      throw new ConflictException(`Vacancy ${id} cannot be published from status ${vacancy.status}`);
    }
    return this.prisma.vacancy.update({
      where: { id },
      data: { status: VacancyStatus.OPEN, openedAt: vacancy.openedAt ?? new Date() },
    });
  }

  async closeVacancy(id: string, filled: boolean) {
    await this.findOneVacancy(id);
    return this.prisma.vacancy.update({
      where: { id },
      data: { status: filled ? VacancyStatus.FILLED : VacancyStatus.CLOSED, closedAt: new Date() },
    });
  }

  async findVacancies(entityId?: string, status?: VacancyStatus) {
    return this.prisma.vacancy.findMany({
      where: { entityId, status },
      include: { _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneVacancy(id: string) {
    const vacancy = await this.prisma.vacancy.findUnique({
      where: { id },
      include: { applications: { include: { candidate: true } } },
    });
    if (!vacancy) throw new NotFoundException(`Vacancy ${id} not found`);
    return vacancy;
  }

  // -------------------------------------------------------------------
  // RECRUITER DASHBOARD & REPORTS
  // -------------------------------------------------------------------

  async recruiterDashboard(entityId?: string) {
    const [openVacancies, pendingRequisitions, applicationsByStage, upcomingInterviews, calendarSyncFailures, teamsSyncFailures] = await Promise.all([
      this.prisma.vacancy.count({ where: { entityId, status: VacancyStatus.OPEN } }),
      this.prisma.jobRequisition.count({ where: { entityId, status: RequisitionStatus.PENDING_APPROVAL } }),
      this.prisma.jobApplication.groupBy({
        by: ['stage'],
        _count: { _all: true },
        where: entityId ? { vacancy: { entityId } } : undefined,
      }),
      this.prisma.interview.count({
        where: {
          status: InterviewStatus.SCHEDULED,
          scheduledAt: { gte: new Date() },
          jobApplication: entityId ? { vacancy: { entityId } } : undefined,
        },
      }),
      // Release IG.1, Checkpoint D — count only here; the actual list of
      // affected interviews is InterviewService.findWithFailedCalendarSync,
      // exposed separately via GET /recruitment/interviews/calendar-sync/failures
      // (same split as this method's own upcomingInterviews count vs.
      // InterviewService.findUpcomingForInterviewer's own list).
      this.prisma.interview.count({
        where: {
          calendarSyncFailedAt: { not: null },
          jobApplication: entityId ? { vacancy: { entityId } } : undefined,
        },
      }),
      // Release IG.1, Checkpoint T — same count-only split as
      // calendarSyncFailures above, for InterviewService.findWithFailedTeamsSync
      // / GET /recruitment/interviews/teams-sync/failures.
      this.prisma.interview.count({
        where: {
          teamsSyncFailedAt: { not: null },
          jobApplication: entityId ? { vacancy: { entityId } } : undefined,
        },
      }),
    ]);

    return {
      openVacancies,
      pendingRequisitions,
      upcomingInterviews,
      calendarSyncFailures,
      teamsSyncFailures,
      pipelineByStage: applicationsByStage.map((r) => ({ stage: r.stage, count: r._count._all })),
    };
  }

  /** Time-to-hire and pipeline conversion, per vacancy, for the recruitment reports view. */
  async recruitmentReport(entityId?: string) {
    const vacancies = await this.prisma.vacancy.findMany({
      where: { entityId },
      include: { applications: true },
    });

    return vacancies.map((v) => {
      const total = v.applications.length;
      const hired = v.applications.filter((a) => a.stage === ApplicationStage.HIRED);
      const rejected = v.applications.filter((a) => a.stage === ApplicationStage.REJECTED).length;
      const avgTimeToHireDays =
        hired.length === 0
          ? null
          : Math.round(
              hired.reduce((sum, a) => sum + (a.updatedAt.getTime() - a.appliedAt.getTime()) / 86_400_000, 0) /
                hired.length,
            );
      return {
        vacancyId: v.id,
        title: v.title,
        status: v.status,
        totalApplications: total,
        hired: hired.length,
        rejected,
        avgTimeToHireDays,
      };
    });
  }
}
