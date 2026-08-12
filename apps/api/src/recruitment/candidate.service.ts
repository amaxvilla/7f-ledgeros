import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ApplicationStage, BackgroundCheckStatus, EmploymentStatus, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsProviderRegistry } from '../contacts/contacts-provider.registry';
import { MS_GRAPH_CONTACTS_PROVIDER_CODE } from '../contacts/providers/microsoft-graph-contacts.provider';
import { WorkspaceAdminProviderRegistry } from '../workspace-admin/workspace-admin-provider.registry';
import { GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE } from '../workspace-admin/providers/google-workspace-admin.provider';

interface UpsertCandidateDto {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: string;
  linkedinUrl?: string;
}

interface AddCandidateDocumentDto {
  candidateId: string;
  documentType: string;
  fileUrl: string;
  fileName?: string;
}

interface ApplyToVacancyDto {
  vacancyId: string;
  candidateId: string;
}

interface HireCandidateDto {
  entityId: string;
  employeeCode: string;
  departmentId?: string;
}

// Forward-only pipeline; REJECTED/WITHDRAWN are terminal and reachable from
// any stage, so they're validated separately rather than listed here.
const STAGE_ORDER: ApplicationStage[] = [
  ApplicationStage.APPLIED,
  ApplicationStage.SCREENING,
  ApplicationStage.SHORTLISTED,
  ApplicationStage.INTERVIEW,
  ApplicationStage.OFFER,
  ApplicationStage.HIRED,
];

const TERMINAL_STAGES = new Set<ApplicationStage>([ApplicationStage.REJECTED, ApplicationStage.WITHDRAWN, ApplicationStage.HIRED]);

@Injectable()
export class CandidateService {
  private readonly logger = new Logger(CandidateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactsProviders: ContactsProviderRegistry,
    private readonly workspaceAdminProviders: WorkspaceAdminProviderRegistry,
  ) {}

  // -------------------------------------------------------------------
  // CANDIDATE PROFILES (also backs the candidate-portal "my profile" view)
  // -------------------------------------------------------------------

  async upsertCandidate(dto: UpsertCandidateDto) {
    if (!dto.email?.trim()) throw new BadRequestException('email is required');

    const existing = await this.prisma.candidate.findUnique({ where: { email: dto.email } });
    const candidate = await this.prisma.candidate.upsert({
      where: { email: dto.email },
      create: dto,
      update: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        source: dto.source,
        linkedinUrl: dto.linkedinUrl,
      },
    });

    // Outlook contact sync (Release IG.1, Checkpoint G) — best-effort, same
    // shape as InterviewService.schedule()'s calendar sync: fired for a
    // brand-new candidate. Checkpoint J below adds the update-sync half
    // for an existing, already-synced candidate — the same split
    // Calendar has between schedule()'s create-sync and reschedule()'s
    // update-sync. A ContactsProvider failure must never lose the
    // candidate row that already exists above.
    if (!existing) {
      const synced = await this.trySyncCreate(candidate.id, {
        displayName: `${candidate.firstName} ${candidate.lastName}`,
        emailAddress: candidate.email,
        phoneNumber: candidate.phone ?? undefined,
      });
      return synced ?? candidate;
    }

    // Release IG.1, Checkpoint J — update-sync, mirroring
    // InterviewService.reschedule()'s own calendarEventId-guarded
    // updateEvent block exactly: only runs when a prior create actually
    // landed (providerContactId + contactProviderCode both set), pushes
    // the edited fields through, and — same as reschedule() — clears a
    // previously-set failure flag on success but leaves it alone on
    // failure (tryMarkSyncFailed already does the "set" side). A
    // candidate whose create-sync never succeeded yet (or is mid-retry)
    // has no providerContactId to update against, so it's left for
    // retryContactSync/a future create-sync attempt instead, same as
    // an interview with no calendarEventId yet is left for
    // retryCalendarSync rather than attempting updateEvent.
    if (existing.providerContactId && existing.contactProviderCode) {
      try {
        const provider = this.contactsProviders.get(existing.contactProviderCode);
        await provider.updateContact({
          providerContactId: existing.providerContactId,
          displayName: `${candidate.firstName} ${candidate.lastName}`,
          emailAddress: candidate.email,
          phoneNumber: candidate.phone ?? undefined,
        });
        if (existing.contactSyncFailedAt) {
          return await this.prisma.candidate.update({ where: { id: candidate.id }, data: { contactSyncFailedAt: null } });
        }
      } catch (err) {
        this.logger.warn(
          `Updated candidate ${candidate.id} but could not update its Outlook contact ${existing.providerContactId}: ${(err as Error).message}`,
        );
        await this.tryMarkSyncFailed(candidate.id);
      }
    }

    return candidate;
  }

  /**
   * Best-effort Outlook-contact creation for a brand-new candidate.
   * Returns the updated candidate row (with providerContactId/
   * contactProviderCode set) on success, or undefined if sync was
   * skipped/failed — callers fall back to the pre-sync row they already
   * have. Hardcoded to MS_GRAPH_CONTACTS_PROVIDER_CODE, same reasoning
   * InterviewService.trySyncCreate's own doc comment gives for calendar
   * sync: the only provider IG.1 has built.
   */
  private async trySyncCreate(
    candidateId: string,
    params: { displayName: string; emailAddress?: string; phoneNumber?: string },
  ) {
    if (!this.contactsProviders.isRegistered(MS_GRAPH_CONTACTS_PROVIDER_CODE)) return undefined;

    try {
      const provider = this.contactsProviders.get(MS_GRAPH_CONTACTS_PROVIDER_CODE);
      const result = await provider.createContact(params);

      return await this.prisma.candidate.update({
        where: { id: candidateId },
        data: { contactProviderCode: MS_GRAPH_CONTACTS_PROVIDER_CODE, providerContactId: result.providerContactId, contactSyncFailedAt: null },
      });
    } catch (err) {
      this.logger.warn(`Created candidate ${candidateId} but could not create its Outlook contact: ${(err as Error).message}`);
      await this.tryMarkSyncFailed(candidateId);
      return undefined;
    }
  }

  /**
   * Best-effort persistence of the contact-sync failure flag itself.
   * Deliberately isolated from the try/catch it's called from, same
   * reasoning InterviewService.tryMarkSyncFailed's own doc comment
   * gives: if THIS update also fails, it must not throw past the caller.
   */
  private async tryMarkSyncFailed(candidateId: string): Promise<void> {
    try {
      await this.prisma.candidate.update({ where: { id: candidateId }, data: { contactSyncFailedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Could not persist contactSyncFailedAt for candidate ${candidateId}: ${(err as Error).message}`);
    }
  }

  /**
   * Release IG.1, Checkpoint H — manual retry for a candidate sitting in
   * `contactSyncFailedAt`, same motivation as InterviewService's own
   * Checkpoint E: give a human a direct action instead of re-saving the
   * candidate and hoping.
   *
   * Updated by Checkpoint J: now that upsertCandidate() has an
   * update-sync path alongside trySyncCreate, contactSyncFailedAt can be
   * set by either one, so — same as retryCalendarSync — the retry
   * branches on whether a prior create actually landed:
   *  - No `providerContactId` yet -> the original create never
   *    succeeded. Re-run trySyncCreate, same as before Checkpoint J.
   *  - `providerContactId` already set -> the create worked and a later
   *    update (an edit made through upsertCandidate) failed. Retry
   *    updateContact against that same providerContactId instead of
   *    creating a second, duplicate Outlook contact.
   *
   * Same asymmetry as retryCalendarSync versus its own best-effort
   * sibling calls: a repeat failure here is surfaced to the caller as a
   * ConflictException rather than swallowed, since this retry has no
   * other primary operation left to protect.
   */
  async retryContactSync(id: string) {
    const existing = await this.findCandidate(id);
    if (!existing.contactSyncFailedAt) {
      throw new BadRequestException(`Candidate ${id} has no failed contact sync to retry`);
    }

    if (!existing.providerContactId) {
      const synced = await this.trySyncCreate(id, {
        displayName: `${existing.firstName} ${existing.lastName}`,
        emailAddress: existing.email,
        phoneNumber: existing.phone ?? undefined,
      });

      if (!synced) {
        throw new ConflictException(`Contact sync retry failed for candidate ${id}`);
      }
      return synced;
    }

    try {
      const provider = this.contactsProviders.get(existing.contactProviderCode!);
      await provider.updateContact({
        providerContactId: existing.providerContactId,
        displayName: `${existing.firstName} ${existing.lastName}`,
        emailAddress: existing.email,
        phoneNumber: existing.phone ?? undefined,
      });
      return await this.prisma.candidate.update({ where: { id }, data: { contactSyncFailedAt: null } });
    } catch (err) {
      await this.tryMarkSyncFailed(id);
      throw new ConflictException(`Contact sync retry failed for candidate ${id}: ${(err as Error).message}`);
    }
  }

  async findCandidate(id: string) {
    const candidate = await this.prisma.candidate.findUnique({
      where: { id },
      include: { documents: true, applications: { include: { vacancy: true, interviews: true, offer: true } } },
    });
    if (!candidate) throw new NotFoundException(`Candidate ${id} not found`);
    return candidate;
  }

  async findCandidates(email?: string) {
    return this.prisma.candidate.findMany({ where: email ? { email: { contains: email } } : undefined });
  }

  // -------------------------------------------------------------------
  // RESUME / CV & OTHER DOCUMENTS
  // -------------------------------------------------------------------

  async addDocument(dto: AddCandidateDocumentDto) {
    await this.findCandidate(dto.candidateId);
    return this.prisma.candidateDocument.create({ data: dto });
  }

  /**
   * Release IG.1, Checkpoint I — the list backing the recruitment
   * "needs attention" widget's contact-sync half, same shape as
   * InterviewService.findWithFailedCalendarSync (see that method's own
   * doc comment). Candidate has no entityId column of its own — unlike
   * Interview, which reaches entityId via jobApplication -> vacancy —
   * so the same path is used here directly: applications -> vacancy ->
   * entityId. A candidate with no applications yet can still have a
   * failed sync (upsertCandidate's create-sync fires before any
   * application exists), so it's included whenever no entityId filter
   * is given, same as a caller without an entityId getting the
   * cross-entity total on the Interview side.
   */
  findWithFailedContactSync(entityId?: string) {
    return this.prisma.candidate.findMany({
      where: {
        contactSyncFailedAt: { not: null },
        applications: entityId ? { some: { vacancy: { entityId } } } : undefined,
      },
      select: { id: true, firstName: true, lastName: true, email: true, contactSyncFailedAt: true },
      orderBy: { contactSyncFailedAt: 'desc' },
    });
  }

  findDocuments(candidateId: string) {
    return this.prisma.candidateDocument.findMany({ where: { candidateId } });
  }

  // -------------------------------------------------------------------
  // APPLICATIONS / HIRING PIPELINE (candidate portal "apply" + recruiter view)
  // -------------------------------------------------------------------

  async apply(dto: ApplyToVacancyDto) {
    const vacancy = await this.prisma.vacancy.findUnique({ where: { id: dto.vacancyId } });
    if (!vacancy) throw new NotFoundException(`Vacancy ${dto.vacancyId} not found`);
    if (vacancy.status !== VacancyStatus.OPEN) {
      throw new ConflictException('This vacancy is not currently accepting applications');
    }

    const existing = await this.prisma.jobApplication.findUnique({
      where: { vacancyId_candidateId: { vacancyId: dto.vacancyId, candidateId: dto.candidateId } },
    });
    if (existing) throw new ConflictException('Candidate has already applied to this vacancy');

    return this.prisma.jobApplication.create({
      data: { vacancyId: dto.vacancyId, candidateId: dto.candidateId, stage: ApplicationStage.APPLIED },
    });
  }

  async findApplication(id: string) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id },
      include: {
        candidate: true,
        vacancy: true,
        interviews: { include: { feedback: true } },
        offer: true,
        backgroundCheck: true,
      },
    });
    if (!app) throw new NotFoundException(`Application ${id} not found`);
    return app;
  }

  async findApplicationsForVacancy(vacancyId: string, stage?: ApplicationStage) {
    return this.prisma.jobApplication.findMany({
      where: { vacancyId, stage },
      include: { candidate: true },
      orderBy: { appliedAt: 'asc' },
    });
  }

  /** For the candidate portal: "track my applications". */
  async findApplicationsForCandidate(candidateId: string) {
    return this.prisma.jobApplication.findMany({
      where: { candidateId },
      include: { vacancy: true, offer: true },
      orderBy: { appliedAt: 'desc' },
    });
  }

  /** Moves an application forward in the pipeline, or to a terminal stage. */
  async advanceStage(id: string, stage: ApplicationStage, rejectionReason?: string) {
    const app = await this.findApplication(id);
    if (TERMINAL_STAGES.has(app.stage) && app.stage !== ApplicationStage.HIRED) {
      throw new ConflictException(`Application ${id} is already in a terminal stage (${app.stage})`);
    }

    if (stage === ApplicationStage.REJECTED || stage === ApplicationStage.WITHDRAWN) {
      return this.prisma.jobApplication.update({ where: { id }, data: { stage, rejectionReason } });
    }

    const currentIdx = STAGE_ORDER.indexOf(app.stage);
    const targetIdx = STAGE_ORDER.indexOf(stage);
    if (targetIdx === -1) throw new BadRequestException(`Invalid pipeline stage ${stage}`);
    if (targetIdx < currentIdx) {
      throw new ConflictException(`Cannot move application backward from ${app.stage} to ${stage}`);
    }
    if (stage === ApplicationStage.HIRED) {
      throw new ConflictException('Use the hire endpoint to move an application into HIRED — it provisions the employee record');
    }

    return this.prisma.jobApplication.update({ where: { id }, data: { stage } });
  }

  /** Candidate scoring, set independently of stage (e.g. after interviews / assessments). */
  async setScore(id: string, score: number) {
    if (score < 0 || score > 100) throw new BadRequestException('score must be between 0 and 100');
    await this.findApplication(id);
    return this.prisma.jobApplication.update({ where: { id }, data: { score } });
  }

  /**
   * Converts an accepted-offer application into an Employee record,
   * reusing the existing Employee Lifecycle module rather than
   * duplicating onboarding logic here.
   *
   * If a background check exists for this application (ported from
   * ZIP A), it must be CLEARED before hiring -- a FLAGGED or still
   * PENDING/IN_PROGRESS check blocks the hire, same as ZIP A's
   * hireApplicant guard.
   */
  /**
   * Best-effort Google Workspace directory-account creation for a
   * brand-new Employee, called from hire() right after the Employee row
   * exists. Returns the updated employee row (with directoryProviderCode/
   * directoryUserId set) on success, or undefined if sync was skipped/
   * failed — callers fall back to the pre-sync row they already have.
   * Same shape as InterviewService.trySyncCreate/CandidateService's own
   * trySyncCreate above: hardcoded to
   * GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE, the only WorkspaceAdminProvider
   * IH has built (Checkpoint H) — same reasoning both of those give for
   * their own hardcoded provider codes.
   *
   * KNOWN GAP, flagged rather than silently worked around: `primaryEmail`
   * is the Employee's own `workEmail`, which hire() currently sets to the
   * candidate's application email (see hire()'s own employee.create call
   * below) — very often a personal address, not a domain the Workspace
   * customer actually owns. Google's Directory API will reject a
   * primaryEmail outside a verified domain, so in practice this call will
   * fail for most real hires until a real corporate-email-assignment step
   * exists somewhere before this point in the hiring flow. That's an
   * unstarted piece of work, not a defect in this best-effort wiring
   * itself — the failure is caught and surfaced via
   * `directorySyncFailedAt` exactly like any other calendar-sync/contact-
   * sync failure already is, not left to throw past hire()'s caller.
   */
  private async trySyncCreateDirectoryUser(
    employeeId: string,
    params: { primaryEmail: string; givenName: string; familyName: string },
  ) {
    if (!this.workspaceAdminProviders.isRegistered(GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE)) return undefined;

    try {
      const provider = this.workspaceAdminProviders.get(GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE);
      const result = await provider.createUser({
        primaryEmail: params.primaryEmail,
        givenName: params.givenName,
        familyName: params.familyName,
        // A one-time temporary password the new hire must change at
        // first login (createUser always sets changePasswordAtNextLogin —
        // see GoogleWorkspaceAdminProvider's own doc comment); never
        // surfaced anywhere, so its randomness is the only property that
        // matters, not its memorability.
        password: randomBytes(24).toString('base64url'),
      });

      return await this.prisma.employee.update({
        where: { id: employeeId },
        data: {
          directoryProviderCode: GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE,
          directoryUserId: result.providerUserId,
          directorySyncFailedAt: null,
        },
      });
    } catch (err) {
      this.logger.warn(`Hired employee ${employeeId} but could not create its Workspace directory account: ${(err as Error).message}`);
      await this.tryMarkDirectorySyncFailed(employeeId);
      return undefined;
    }
  }

  /**
   * Best-effort persistence of the directory-sync failure flag itself.
   * Deliberately isolated from the try/catch it's called from, same
   * reasoning tryMarkSyncFailed's own doc comment gives above: if THIS
   * update also fails, it must not throw past the caller.
   */
  private async tryMarkDirectorySyncFailed(employeeId: string): Promise<void> {
    try {
      await this.prisma.employee.update({ where: { id: employeeId }, data: { directorySyncFailedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Could not persist directorySyncFailedAt for employee ${employeeId}: ${(err as Error).message}`);
    }
  }

  /**
   * Release IH, Checkpoint J — manual retry for an employee sitting in
   * `directorySyncFailedAt`, same motivation as retryCalendarSync/
   * retryContactSync: give a human a direct action instead of re-hiring
   * and hoping.
   *
   * Only ONE retry shape exists today, unlike retryCalendarSync's/
   * retryContactSync's two: trySyncCreateDirectoryUser and
   * tryMarkDirectorySyncFailed are the only two places that touch
   * directoryUserId/directorySyncFailedAt, and nothing yet calls
   * setUserSuspended/deleteUser (Checkpoint H's own audit already
   * flagged both as unwired) — so a set directorySyncFailedAt can only
   * mean the original create itself failed; `directoryUserId` and
   * `directorySyncFailedAt` are mutually exclusive in every reachable
   * state today. The "directoryUserId already set" branch
   * retryCalendarSync/retryContactSync each have for their own later-
   * update-failed case is deliberately NOT added here speculatively —
   * it would be dead, untestable code until a future checkpoint actually
   * wires one of those calls. Guarded explicitly below instead of
   * silently mis-retrying as a second create.
   */
  async retryDirectorySync(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    if (!employee.directorySyncFailedAt) {
      throw new BadRequestException(`Employee ${employeeId} has no failed directory sync to retry`);
    }
    if (employee.directoryUserId) {
      throw new ConflictException(
        `Employee ${employeeId} already has a directory user (${employee.directoryUserId}); no update/suspend retry path exists yet`,
      );
    }

    const synced = await this.trySyncCreateDirectoryUser(employeeId, {
      primaryEmail: employee.workEmail!,
      givenName: employee.firstName,
      familyName: employee.lastName,
    });

    if (!synced) {
      throw new ConflictException(`Directory sync retry failed for employee ${employeeId}`);
    }
    return synced;
  }

  async hire(id: string, dto: HireCandidateDto) {
    const app = await this.findApplication(id);
    if (app.stage !== ApplicationStage.OFFER || app.offer?.status !== 'ACCEPTED') {
      throw new ConflictException('Application must have an ACCEPTED offer before hiring');
    }
    if (app.backgroundCheck && app.backgroundCheck.status !== BackgroundCheckStatus.CLEARED) {
      throw new ConflictException(`Background check is ${app.backgroundCheck.status}, not CLEARED`);
    }

    const employee = await this.prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          entityId: dto.entityId,
          departmentId: dto.departmentId ?? app.vacancy.departmentId,
          employeeCode: dto.employeeCode,
          firstName: app.candidate.firstName,
          lastName: app.candidate.lastName,
          jobTitle: app.offer?.jobTitle,
          gradeLevel: app.offer?.gradeLevel,
          employmentType: app.vacancy.employmentType,
          employmentStatus: EmploymentStatus.PROBATION,
          hireDate: new Date(),
          workEmail: app.candidate.email,
          phone: app.candidate.phone,
        },
      });

      await tx.jobApplication.update({
        where: { id },
        data: { stage: ApplicationStage.HIRED, hiredEmployeeId: created.id },
      });

      return created;
    });

    // Google Workspace directory-account sync (Release IH, Checkpoint I) —
    // best-effort, same never-block-the-primary-record posture as
    // InterviewService.schedule()'s own calendar sync: a Directory API
    // failure must never lose the Employee row that already exists above.
    // Called after the transaction commits, not inside it — same reason
    // trySyncCreate is never called from inside interview.create's own
    // transaction where one exists: a provider HTTP call has no business
    // holding a database transaction open.
    const synced = await this.trySyncCreateDirectoryUser(employee.id, {
      primaryEmail: employee.workEmail!,
      givenName: employee.firstName,
      familyName: employee.lastName,
    });

    return synced ?? employee;
  }
}
