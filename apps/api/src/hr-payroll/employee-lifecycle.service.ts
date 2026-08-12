import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssetAssignmentStatus,
  DisciplinaryCaseStatus,
  DisciplinaryCaseType,
  EmploymentEventType,
  EmploymentStatus,
  ExitClearanceItemStatus,
  ExitClearanceStatus,
  ExitType,
  OnboardingTaskStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

interface UpdateEmployeeProfileDto {
  photoUrl?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  maritalStatus?: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
  nationality?: string;
  stateOfOrigin?: string;
  phone?: string;
  personalEmail?: string;
  workEmail?: string;
  residentialAddress?: string;
  jobTitle?: string;
  gradeLevel?: string;
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN' | 'CONSULTANT';
  hireDate?: string;
  reportsToId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  pensionPin?: string;
  taxId?: string;
}

interface AddDocumentDto {
  employeeId: string;
  documentType: string;
  fileUrl: string;
  description?: string;
}

interface AddNextOfKinDto {
  employeeId: string;
  name: string;
  relationship: string;
  phone: string;
  address?: string;
}

interface AddEmergencyContactDto {
  employeeId: string;
  name: string;
  relationship: string;
  phone: string;
}

interface AssignAssetDto {
  employeeId: string;
  assetName: string;
  assetTag?: string;
  description?: string;
}

interface CreateOnboardingTaskDto {
  employeeId: string;
  taskName: string;
  description?: string;
  dueDate?: string;
}

interface RaiseDisciplinaryCaseDto {
  employeeId: string;
  caseType: DisciplinaryCaseType;
  description: string;
}

interface InitiateExitDto {
  employeeId: string;
  exitType: ExitType;
  noticeDate: string;
  lastWorkingDate: string;
  reason?: string;
  /** Clearance checklist item names per department, e.g. { IT: ['Return laptop'], Finance: ['Settle advances'] } */
  clearanceChecklist: Record<string, string[]>;
}

interface RecordEmploymentEventDto {
  employeeId: string;
  eventType: EmploymentEventType;
  effectiveDate: string;
  toDepartmentId?: string;
  toJobTitle?: string;
  toGradeLevel?: string;
  notes?: string;
}

const STANDARD_ONBOARDING_TASKS = [
  'Collect signed offer letter',
  'IT account & email provisioning',
  'Issue ID card',
  'HR policy briefing',
  'Assign onboarding buddy',
  'Set up payroll & bank details',
  'Statutory registrations (pension, tax)',
];

@Injectable()
export class EmployeeLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------
  // EMPLOYEE PROFILE
  // -------------------------------------------------------------------

  async updateProfile(employeeId: string, dto: UpdateEmployeeProfileDto) {
    await this.getEmployeeOrThrow(employeeId);
    if (dto.reportsToId === employeeId) {
      throw new BadRequestException('An employee cannot report to themselves');
    }
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
      },
    });
  }

  async findOneEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        salaryStructure: true,
        reportsTo: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
        directReports: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
        documents: true,
        nextOfKin: true,
        emergencyContacts: true,
        assetAssignments: true,
        onboardingTasks: true,
        exitRecord: { include: { clearanceItems: true } },
      },
    });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    return employee;
  }

  /** Confirms an employee out of probation (a discrete, auditable event). */
  async confirmEmployee(employeeId: string) {
    const employee = await this.getEmployeeOrThrow(employeeId);
    if (employee.employmentStatus !== EmploymentStatus.PROBATION) {
      throw new ConflictException(`Employee is ${employee.employmentStatus}, not on probation`);
    }
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { employmentStatus: EmploymentStatus.CONFIRMED, confirmationDate: new Date() },
    });
  }

  /**
   * Logs a transfer/promotion/demotion/secondment/contract-renewal event
   * and applies its "to" values onto the Employee record in the same
   * transaction, so EmploymentEvent is always an accurate history of what
   * actually changed (not just an intent record).
   */
  async recordEmploymentEvent(dto: RecordEmploymentEventDto, initiatedById: string) {
    const employee = await this.getEmployeeOrThrow(dto.employeeId);

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.employmentEvent.create({
        data: {
          employeeId: dto.employeeId,
          eventType: dto.eventType,
          effectiveDate: new Date(dto.effectiveDate),
          fromDepartmentId: employee.departmentId,
          toDepartmentId: dto.toDepartmentId,
          fromJobTitle: employee.jobTitle,
          toJobTitle: dto.toJobTitle,
          fromGradeLevel: employee.gradeLevel,
          toGradeLevel: dto.toGradeLevel,
          notes: dto.notes,
          initiatedById,
        },
      });

      const updateData: Record<string, unknown> = {};
      if (dto.toDepartmentId) updateData.departmentId = dto.toDepartmentId;
      if (dto.toJobTitle) updateData.jobTitle = dto.toJobTitle;
      if (dto.toGradeLevel) updateData.gradeLevel = dto.toGradeLevel;
      if (dto.eventType === EmploymentEventType.CONFIRMATION) {
        updateData.employmentStatus = EmploymentStatus.CONFIRMED;
        updateData.confirmationDate = new Date(dto.effectiveDate);
      }
      if (Object.keys(updateData).length > 0) {
        await tx.employee.update({ where: { id: dto.employeeId }, data: updateData });
      }

      return event;
    });
  }

  findEmploymentHistory(employeeId: string) {
    return this.prisma.employmentEvent.findMany({ where: { employeeId }, orderBy: { effectiveDate: 'desc' } });
  }

  /** Flat org-chart edge list (employeeId -> reportsToId) for an entity. */
  async organizationChart(entityId: string) {
    const employees = await this.prisma.employee.findMany({
      where: { entityId, isActive: true },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, reportsToId: true, departmentId: true },
    });
    return employees;
  }

  // -------------------------------------------------------------------
  // DOCUMENTS / NEXT OF KIN / EMERGENCY CONTACTS
  // -------------------------------------------------------------------

  async addDocument(dto: AddDocumentDto, uploadedById: string) {
    await this.getEmployeeOrThrow(dto.employeeId);
    return this.prisma.employeeDocument.create({ data: { ...dto, uploadedById } });
  }

  async addNextOfKin(dto: AddNextOfKinDto) {
    await this.getEmployeeOrThrow(dto.employeeId);
    return this.prisma.employeeNextOfKin.create({ data: dto });
  }

  async addEmergencyContact(dto: AddEmergencyContactDto) {
    await this.getEmployeeOrThrow(dto.employeeId);
    return this.prisma.employeeEmergencyContact.create({ data: dto });
  }

  // -------------------------------------------------------------------
  // ONBOARDING
  // -------------------------------------------------------------------

  /** Seeds the standard onboarding checklist for a newly hired employee. */
  async startOnboarding(employeeId: string, dueDate?: string) {
    await this.getEmployeeOrThrow(employeeId);
    const existing = await this.prisma.onboardingTask.findMany({ where: { employeeId } });
    if (existing.length > 0) {
      throw new ConflictException('Onboarding checklist already exists for this employee');
    }
    return this.prisma.onboardingTask.createMany({
      data: STANDARD_ONBOARDING_TASKS.map((taskName) => ({
        employeeId,
        taskName,
        dueDate: dueDate ? new Date(dueDate) : undefined,
      })),
    });
  }

  async createOnboardingTask(dto: CreateOnboardingTaskDto) {
    await this.getEmployeeOrThrow(dto.employeeId);
    return this.prisma.onboardingTask.create({
      data: { ...dto, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined },
    });
  }

  async completeOnboardingTask(taskId: string, completedById: string) {
    const task = await this.prisma.onboardingTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException(`Onboarding task ${taskId} not found`);
    return this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: { status: OnboardingTaskStatus.COMPLETED, completedAt: new Date(), completedById },
    });
  }

  findOnboardingTasks(employeeId: string) {
    return this.prisma.onboardingTask.findMany({ where: { employeeId }, orderBy: { dueDate: 'asc' } });
  }

  // -------------------------------------------------------------------
  // ASSET ASSIGNMENT
  // -------------------------------------------------------------------

  async assignAsset(dto: AssignAssetDto, issuedById: string) {
    await this.getEmployeeOrThrow(dto.employeeId);
    return this.prisma.employeeAssetAssignment.create({ data: { ...dto, issuedById } });
  }

  async returnAsset(assignmentId: string, condition?: string) {
    const assignment = await this.prisma.employeeAssetAssignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException(`Asset assignment ${assignmentId} not found`);
    if (assignment.status !== AssetAssignmentStatus.ASSIGNED) {
      throw new ConflictException(`Asset assignment is already ${assignment.status}`);
    }
    return this.prisma.employeeAssetAssignment.update({
      where: { id: assignmentId },
      data: { status: AssetAssignmentStatus.RETURNED, returnedDate: new Date(), condition },
    });
  }

  findAssetAssignments(employeeId: string) {
    return this.prisma.employeeAssetAssignment.findMany({ where: { employeeId } });
  }

  /** Every asset still ASSIGNED to an employee — the gate exit clearance checks. */
  private findOutstandingAssets(employeeId: string) {
    return this.prisma.employeeAssetAssignment.findMany({
      where: { employeeId, status: AssetAssignmentStatus.ASSIGNED },
    });
  }

  // -------------------------------------------------------------------
  // DISCIPLINARY
  // -------------------------------------------------------------------

  raiseDisciplinaryCase(dto: RaiseDisciplinaryCaseDto, raisedById: string) {
    return this.prisma.disciplinaryCase.create({ data: { ...dto, raisedById } });
  }

  async closeDisciplinaryCase(caseId: string, outcome: string) {
    const record = await this.prisma.disciplinaryCase.findUnique({ where: { id: caseId } });
    if (!record) throw new NotFoundException(`Disciplinary case ${caseId} not found`);
    if (record.status === DisciplinaryCaseStatus.CLOSED) {
      throw new ConflictException('Disciplinary case is already closed');
    }
    return this.prisma.disciplinaryCase.update({
      where: { id: caseId },
      data: { status: DisciplinaryCaseStatus.CLOSED, outcome, closedAt: new Date() },
    });
  }

  findDisciplinaryCases(employeeId: string) {
    return this.prisma.disciplinaryCase.findMany({ where: { employeeId }, orderBy: { raisedAt: 'desc' } });
  }

  // -------------------------------------------------------------------
  // EXIT & CLEARANCE
  // -------------------------------------------------------------------

  async initiateExit(dto: InitiateExitDto, initiatedById: string) {
    const employee = await this.getEmployeeOrThrow(dto.employeeId);
    const existing = await this.prisma.employeeExit.findUnique({ where: { employeeId: dto.employeeId } });
    if (existing) throw new ConflictException(`Employee ${employee.employeeCode} already has an exit record`);

    const clearanceItems = Object.entries(dto.clearanceChecklist).flatMap(([department, items]) =>
      items.map((item) => ({ department, item })),
    );
    if (clearanceItems.length === 0) {
      throw new BadRequestException('At least one clearance checklist item is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const exit = await tx.employeeExit.create({
        data: {
          employeeId: dto.employeeId,
          exitType: dto.exitType,
          noticeDate: new Date(dto.noticeDate),
          lastWorkingDate: new Date(dto.lastWorkingDate),
          reason: dto.reason,
          initiatedById,
          clearanceStatus: ExitClearanceStatus.IN_PROGRESS,
          clearanceItems: { create: clearanceItems },
        },
        include: { clearanceItems: true },
      });
      await tx.employee.update({
        where: { id: dto.employeeId },
        data: {
          employmentStatus: dto.exitType === ExitType.TERMINATION ? EmploymentStatus.TERMINATED : EmploymentStatus.RESIGNED,
        },
      });
      return exit;
    });
  }

  async clearExitItem(itemId: string, clearedById: string, remarks?: string) {
    const item = await this.prisma.exitClearanceItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Clearance item ${itemId} not found`);

    const outstandingAssets = await this.findOutstandingAssets(
      (await this.prisma.employeeExit.findUniqueOrThrow({ where: { id: item.employeeExitId } })).employeeId,
    );
    if (item.department === 'IT' && item.item.toLowerCase().includes('asset') && outstandingAssets.length > 0) {
      throw new ConflictException(
        `Cannot clear: ${outstandingAssets.length} asset(s) are still assigned to this employee`,
      );
    }

    await this.prisma.exitClearanceItem.update({
      where: { id: itemId },
      data: { status: ExitClearanceItemStatus.CLEARED, clearedById, clearedAt: new Date(), remarks },
    });

    return this.recomputeExitClearanceStatus(item.employeeExitId);
  }

  /** Rolls up clearance-item statuses into the parent exit record's overall status. */
  private async recomputeExitClearanceStatus(employeeExitId: string) {
    const items = await this.prisma.exitClearanceItem.findMany({ where: { employeeExitId } });
    const allCleared = items.every((i) => i.status === ExitClearanceItemStatus.CLEARED);
    return this.prisma.employeeExit.update({
      where: { id: employeeExitId },
      data: {
        clearanceStatus: allCleared ? ExitClearanceStatus.COMPLETED : ExitClearanceStatus.IN_PROGRESS,
        clearedAt: allCleared ? new Date() : undefined,
      },
      include: { clearanceItems: true },
    });
  }

  async findExitRecord(employeeId: string) {
    const exit = await this.prisma.employeeExit.findUnique({
      where: { employeeId },
      include: { clearanceItems: true },
    });
    if (!exit) throw new NotFoundException(`No exit record for employee ${employeeId}`);
    return exit;
  }

  // -------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------

  private async getEmployeeOrThrow(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    return employee;
  }
}
