import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApplicationStage, InterviewRecommendation, InterviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarProviderRegistry } from '../calendar/calendar-provider.registry';
import { MS_GRAPH_CALENDAR_PROVIDER_CODE } from '../calendar/providers/microsoft-graph-calendar.provider';
import { PresenceProviderRegistry } from '../presence/presence-provider.registry';
import { MS_GRAPH_PRESENCE_PROVIDER_CODE } from '../presence/providers/microsoft-graph-presence.provider';
import { PresenceResult } from '../presence/presence-provider.interface';
import { TeamsProviderRegistry } from '../teams/teams-provider.registry';
import { MS_GRAPH_TEAMS_PROVIDER_CODE } from '../teams/providers/microsoft-teams.provider';

/** The exact location value that triggers Teams meeting sync — matches the Interview.location schema comment ("physical or \"video-call\""). */
const VIDEO_CALL_LOCATION = 'video-call';

interface ScheduleInterviewDto {
  jobApplicationId: string;
  round?: number;
  title: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  interviewerEmployeeIds: string[];
}

interface RescheduleInterviewDto {
  scheduledAt: string;
  location?: string;
}

interface SubmitFeedbackDto {
  interviewId: string;
  employeeId: string;
  rating: number;
  recommendation: InterviewRecommendation;
  strengths?: string;
  concerns?: string;
  comments?: string;
}

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarProviders: CalendarProviderRegistry,
    private readonly presenceProviders: PresenceProviderRegistry,
    private readonly teamsProviders: TeamsProviderRegistry,
  ) {}

  // -------------------------------------------------------------------
  // SCHEDULING
  // -------------------------------------------------------------------

  async schedule(dto: ScheduleInterviewDto) {
    const app = await this.prisma.jobApplication.findUnique({
      where: { id: dto.jobApplicationId },
      include: { candidate: true },
    });
    if (!app) throw new NotFoundException(`Application ${dto.jobApplicationId} not found`);
    if (!dto.interviewerEmployeeIds?.length) {
      throw new BadRequestException('At least one interviewer is required');
    }

    const interview = await this.prisma.interview.create({
      data: {
        jobApplicationId: dto.jobApplicationId,
        round: dto.round ?? 1,
        title: dto.title,
        scheduledAt: new Date(dto.scheduledAt),
        durationMinutes: dto.durationMinutes ?? 60,
        location: dto.location,
        status: InterviewStatus.SCHEDULED,
        interviewers: { create: dto.interviewerEmployeeIds.map((employeeId) => ({ employeeId })) },
      },
      include: { interviewers: true },
    });

    // Applications move into INTERVIEW stage the moment the first interview
    // is scheduled, mirroring how a recruiter would track the pipeline.
    if (app.stage === ApplicationStage.APPLIED || app.stage === ApplicationStage.SCREENING || app.stage === ApplicationStage.SHORTLISTED) {
      await this.prisma.jobApplication.update({
        where: { id: dto.jobApplicationId },
        data: { stage: ApplicationStage.INTERVIEW },
      });
    }

    // Calendar sync (Release IG.1, Checkpoint C) — best-effort, same shape as
    // MonoLinkedAccountService.link()'s display-metadata fetch: a Graph API
    // failure (missing permission grant, expired app secret, etc.) must
    // never lose the interview row that already exists above.
    const synced = await this.trySyncCreate(interview.id, {
      title: interview.title,
      startTime: interview.scheduledAt,
      durationMinutes: interview.durationMinutes,
      location: interview.location ?? undefined,
      interviewerEmployeeIds: dto.interviewerEmployeeIds,
      candidateEmail: app.candidate?.email,
    });

    // Teams meeting sync (Release IG.1, Checkpoint S) — best-effort, same
    // never-block-the-interview posture as the calendar sync above. Only
    // for video-call interviews; see trySyncTeamsMeeting's own comment.
    const withTeams = await this.trySyncTeamsMeeting((synced ?? interview).id, {
      title: interview.title,
      startTime: interview.scheduledAt,
      durationMinutes: interview.durationMinutes,
      location: interview.location ?? undefined,
      interviewerEmployeeIds: dto.interviewerEmployeeIds,
    });

    return withTeams ?? synced ?? interview;
  }

  async reschedule(id: string, dto: RescheduleInterviewDto) {
    const existing = await this.findOne(id);
    const updated = await this.prisma.interview.update({
      where: { id },
      data: { scheduledAt: new Date(dto.scheduledAt), location: dto.location, status: InterviewStatus.RESCHEDULED },
    });

    if (existing.calendarEventId && existing.calendarProviderCode) {
      try {
        const provider = this.calendarProviders.get(existing.calendarProviderCode);
        await provider.updateEvent({
          providerEventId: existing.calendarEventId,
          startTime: updated.scheduledAt,
          endTime: new Date(updated.scheduledAt.getTime() + updated.durationMinutes * 60_000),
          location: dto.location,
        });
        if (existing.calendarSyncFailedAt) {
          await this.prisma.interview.update({ where: { id }, data: { calendarSyncFailedAt: null } });
        }
      } catch (err) {
        this.logger.warn(
          `Rescheduled interview ${id} but could not update its calendar event ${existing.calendarEventId}: ${(err as Error).message}`,
        );
        await this.tryMarkSyncFailed(id);
      }
    }

    return updated;
  }

  async cancel(id: string) {
    const existing = await this.findOne(id);
    const updated = await this.prisma.interview.update({ where: { id }, data: { status: InterviewStatus.CANCELLED } });

    if (existing.calendarEventId && existing.calendarProviderCode) {
      try {
        const provider = this.calendarProviders.get(existing.calendarProviderCode);
        await provider.cancelEvent({ providerEventId: existing.calendarEventId, comment: 'Interview cancelled' });
      } catch (err) {
        this.logger.warn(
          `Cancelled interview ${id} but could not cancel its calendar event ${existing.calendarEventId}: ${(err as Error).message}`,
        );
        await this.tryMarkSyncFailed(id);
      }
    }

    if (existing.teamsMeetingId && existing.teamsProviderCode) {
      const organizerIdentifier = await this.resolveTeamsOrganizer(
        existing.interviewers as Array<{ employeeId: string; employee?: { workEmail: string | null } }>,
      );
      if (organizerIdentifier) {
        try {
          const provider = this.teamsProviders.get(existing.teamsProviderCode);
          await provider.cancelMeeting({ providerMeetingId: existing.teamsMeetingId, organizerIdentifier });
        } catch (err) {
          // Release IG.1, Checkpoint T — now persisted (previously logged
          // only; see trySyncTeamsMeeting's own comment for the matching
          // create-side change).
          this.logger.warn(
            `Cancelled interview ${id} but could not cancel its Teams meeting ${existing.teamsMeetingId}: ${(err as Error).message}`,
          );
          await this.tryMarkTeamsSyncFailed(id);
        }
      }
    }

    return updated;
  }

  /**
   * Best-effort calendar-event creation for a just-scheduled interview.
   * Returns the updated interview row (with calendarEventId/calendarProviderCode
   * set) on success, or undefined if sync was skipped/failed — callers fall
   * back to the pre-sync row they already have rather than treating this as
   * fatal. Hardcoded to MS_GRAPH_CALENDAR_PROVIDER_CODE for now — the only
   * provider IG.1 has built; a later checkpoint (once IG.2 Google Workspace
   * exists) can add real provider selection the way PaymentsService takes an
   * explicit providerCode, rather than this guessing between two.
   */
  private async trySyncCreate(
    interviewId: string,
    params: {
      title: string;
      startTime: Date;
      durationMinutes: number;
      location?: string;
      interviewerEmployeeIds: string[];
      candidateEmail?: string;
    },
  ) {
    if (!this.calendarProviders.isRegistered(MS_GRAPH_CALENDAR_PROVIDER_CODE)) return undefined;

    try {
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: params.interviewerEmployeeIds } },
        select: { workEmail: true },
      });
      const attendeeEmails = [params.candidateEmail, ...employees.map((e: { workEmail: string | null }) => e.workEmail)].filter(
        (email): email is string => !!email,
      );

      const provider = this.calendarProviders.get(MS_GRAPH_CALENDAR_PROVIDER_CODE);
      const result = await provider.createEvent({
        title: params.title,
        startTime: params.startTime,
        endTime: new Date(params.startTime.getTime() + params.durationMinutes * 60_000),
        attendeeEmails,
        location: params.location,
      });

      return await this.prisma.interview.update({
        where: { id: interviewId },
        data: { calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE, calendarEventId: result.providerEventId, calendarSyncFailedAt: null },
      });
    } catch (err) {
      this.logger.warn(`Scheduled interview ${interviewId} but could not create its calendar event: ${(err as Error).message}`);
      await this.tryMarkSyncFailed(interviewId);
      return undefined;
    }
  }

  /**
   * Release IG.1, Checkpoint D — best-effort persistence of the
   * calendar-sync failure flag itself. Deliberately isolated from the
   * try/catch it's called from: if THIS update also fails (DB blip on
   * top of a Graph failure), it must not throw past the caller, which
   * has already decided to swallow the original error and keep going.
   */
  private async tryMarkSyncFailed(interviewId: string): Promise<void> {
    try {
      await this.prisma.interview.update({ where: { id: interviewId }, data: { calendarSyncFailedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Could not persist calendarSyncFailedAt for interview ${interviewId}: ${(err as Error).message}`);
    }
  }

  /**
   * Release IG.1, Checkpoint S — best-effort Teams online-meeting creation
   * for a just-scheduled interview, mirroring trySyncCreate's own posture
   * exactly: returns the updated interview row (with teamsMeetingId/
   * teamsProviderCode/teamsJoinUrl set) on success, or undefined if sync
   * was skipped/failed — callers fall back to the row they already have.
   *
   * Only fires for `location === "video-call"` (the exact string the
   * schema's own comment on Interview.location names) — an in-person
   * interview has no business getting a Teams link. Hardcoded to
   * MS_GRAPH_TEAMS_PROVIDER_CODE for now, same single-provider posture
   * trySyncCreate itself takes toward MS_GRAPH_CALENDAR_PROVIDER_CODE.
   *
   * Organizer resolution: the first listed interviewer's workEmail — see
   * resolveTeamsOrganizer's own comment for why. If that can't be
   * resolved, sync is skipped (logged, not thrown) rather than guessing
   * at a fallback organizer.
   */
  private async trySyncTeamsMeeting(
    interviewId: string,
    params: { title: string; startTime: Date; durationMinutes: number; location?: string; interviewerEmployeeIds: string[] },
  ) {
    if (params.location !== VIDEO_CALL_LOCATION) return undefined;
    if (!this.teamsProviders.isRegistered(MS_GRAPH_TEAMS_PROVIDER_CODE)) return undefined;

    try {
      const employees = await this.prisma.employee.findMany({
        where: { id: { in: params.interviewerEmployeeIds } },
        select: { id: true, workEmail: true },
      });
      const organizerIdentifier = this.pickOrganizer(params.interviewerEmployeeIds, employees);
      if (!organizerIdentifier) {
        this.logger.warn(`Scheduled video-call interview ${interviewId} but no interviewer has a workEmail on file to organize the Teams meeting`);
        return undefined;
      }

      const provider = this.teamsProviders.get(MS_GRAPH_TEAMS_PROVIDER_CODE);
      const result = await provider.createMeeting({
        subject: params.title,
        startTime: params.startTime,
        endTime: new Date(params.startTime.getTime() + params.durationMinutes * 60_000),
        organizerIdentifier,
      });

      return await this.prisma.interview.update({
        where: { id: interviewId },
        data: {
          teamsProviderCode: MS_GRAPH_TEAMS_PROVIDER_CODE,
          teamsMeetingId: result.providerMeetingId,
          teamsJoinUrl: result.joinUrl,
          teamsSyncFailedAt: null,
        },
      });
    } catch (err) {
      // Release IG.1, Checkpoint T — the visibility gap this comment used
      // to name is now closed: still logged (kept for operational
      // debugging), but also persisted via tryMarkTeamsSyncFailed so a
      // human can find and retry it.
      this.logger.warn(`Scheduled video-call interview ${interviewId} but could not create its Teams meeting: ${(err as Error).message}`);
      await this.tryMarkTeamsSyncFailed(interviewId);
      return undefined;
    }
  }

  /**
   * Release IG.1, Checkpoint T — best-effort persistence of the
   * Teams-sync failure flag itself. Same isolation reasoning as
   * tryMarkSyncFailed: a DB error on top of a Graph error must not throw
   * past the caller, which has already decided to swallow the original
   * error and keep going.
   */
  private async tryMarkTeamsSyncFailed(interviewId: string): Promise<void> {
    try {
      await this.prisma.interview.update({ where: { id: interviewId }, data: { teamsSyncFailedAt: new Date() } });
    } catch (err) {
      this.logger.warn(`Could not persist teamsSyncFailedAt for interview ${interviewId}: ${(err as Error).message}`);
    }
  }

  /**
   * First listed interviewer with a workEmail on file organizes the
   * Teams meeting — the meeting is conceptually "theirs" (they run it),
   * same reasoning presence's own Checkpoint P design note gives for
   * using workEmail as the Graph join key, not an arbitrary shared
   * mailbox. Order follows `interviewerEmployeeIds` as given by the
   * caller, not `employees`' own findMany order (Prisma doesn't
   * guarantee `id: { in: [...] }` preserves input order).
   */
  private pickOrganizer(interviewerEmployeeIds: string[], employees: Array<{ id: string; workEmail: string | null }>): string | undefined {
    const byId = new Map(employees.map((e) => [e.id, e.workEmail]));
    for (const employeeId of interviewerEmployeeIds) {
      const workEmail = byId.get(employeeId);
      if (workEmail) return workEmail;
    }
    return undefined;
  }

  /** Same resolution as pickOrganizer, but starting from already-loaded panelist rows (used by cancel(), which already has `existing.interviewers` from findOne's include) instead of re-querying `employee`. */
  private async resolveTeamsOrganizer(interviewers: Array<{ employeeId: string; employee?: { workEmail: string | null } }>): Promise<string | undefined> {
    for (const panelist of interviewers) {
      if (panelist.employee?.workEmail) return panelist.employee.workEmail;
    }
    return undefined;
  }

  /**
   * Release IG.1, Checkpoint E — manual retry for an interview sitting in
   * `calendarSyncFailedAt`. The only way that flag could clear before this
   * checkpoint was a subsequent schedule/reschedule call happening to touch
   * the same interview again (or, for a failed cancel, never — see the
   * schema doc comment on `calendarSyncFailedAt`); this gives a human a
   * direct action instead of "reschedule it to the same time and hope".
   *
   * Two distinct retry shapes, matching the two ways this flag gets set:
   *  - No `calendarEventId` yet -> the original create never succeeded.
   *    Re-run the exact same `trySyncCreate` path `schedule()` uses, so a
   *    successful retry ends up identical to a successful first attempt.
   *  - `calendarEventId` already exists -> the create worked and a later
   *    update or cancel failed. Retry whichever one matches the interview's
   *    current status (CANCELLED implies the cancel call is what failed;
   *    anything else implies the most recent reschedule's update call did).
   *
   * Unlike the best-effort paths in schedule/reschedule/cancel (which must
   * never let a Graph failure fail the primary operation because the
   * primary operation already succeeded before the calendar call), this
   * retry has no other primary operation to protect — so, unlike those,
   * a repeat failure is surfaced to the caller as a ConflictException
   * rather than swallowed. It also clears the flag on success even for a
   * previously-failed cancel, which cancel()'s own failure path
   * deliberately never does on its own — this is a human explicitly
   * confirming the fix, not an automatic side effect of an unrelated call.
   */
  async retryCalendarSync(id: string) {
    const existing = await this.findOne(id);
    if (!existing.calendarSyncFailedAt) {
      throw new BadRequestException(`Interview ${id} has no failed calendar sync to retry`);
    }

    if (!existing.calendarEventId) {
      const interviewers = existing.interviewers as { employeeId: string }[];
      const synced = await this.trySyncCreate(id, {
        title: existing.title,
        startTime: existing.scheduledAt,
        durationMinutes: existing.durationMinutes,
        location: existing.location ?? undefined,
        interviewerEmployeeIds: interviewers.map((p) => p.employeeId),
        candidateEmail: existing.jobApplication?.candidate?.email,
      });
      return synced ?? existing;
    }

    const provider = this.calendarProviders.get(existing.calendarProviderCode!);
    try {
      if (existing.status === InterviewStatus.CANCELLED) {
        await provider.cancelEvent({ providerEventId: existing.calendarEventId, comment: 'Interview cancelled' });
      } else {
        await provider.updateEvent({
          providerEventId: existing.calendarEventId,
          startTime: existing.scheduledAt,
          endTime: new Date(existing.scheduledAt.getTime() + existing.durationMinutes * 60_000),
          location: existing.location ?? undefined,
        });
      }
      return await this.prisma.interview.update({ where: { id }, data: { calendarSyncFailedAt: null } });
    } catch (err) {
      await this.tryMarkSyncFailed(id);
      throw new ConflictException(`Calendar sync retry failed for interview ${id}: ${(err as Error).message}`);
    }
  }

  async complete(id: string) {
    await this.findOne(id);
    return this.prisma.interview.update({ where: { id }, data: { status: InterviewStatus.COMPLETED } });
  }

  async markNoShow(id: string) {
    await this.findOne(id);
    return this.prisma.interview.update({ where: { id }, data: { status: InterviewStatus.NO_SHOW } });
  }

  async findOne(id: string) {
    const interview = await this.prisma.interview.findUnique({
      where: { id },
      include: { interviewers: { include: { employee: true } }, feedback: true, jobApplication: { include: { candidate: true } } },
    });
    if (!interview) throw new NotFoundException(`Interview ${id} not found`);
    return interview;
  }

  findForApplication(jobApplicationId: string) {
    return this.prisma.interview.findMany({
      where: { jobApplicationId },
      include: { interviewers: true, feedback: true },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  findUpcomingForInterviewer(employeeId: string) {
    return this.prisma.interview.findMany({
      where: { status: InterviewStatus.SCHEDULED, interviewers: { some: { employeeId } } },
      include: { jobApplication: { include: { candidate: true, vacancy: true } } },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  /**
   * Release IG.1, Checkpoint D — the list backing the "needs attention"
   * widget. Same shape as MonoLinkedAccountService.getOverview's
   * needsReauth list: a plain findMany filtered on the failure flag, no
   * separate aggregation table. entityId filters via the same
   * jobApplication -> vacancy -> entityId path RecruitmentService's own
   * recruiterDashboard() already uses for its interview count, so a
   * caller without an entityId gets the cross-entity total (recruiterDashboard
   * passes one through when it has one).
   */
  findWithFailedCalendarSync(entityId?: string) {
    return this.prisma.interview.findMany({
      where: {
        calendarSyncFailedAt: { not: null },
        jobApplication: entityId ? { vacancy: { entityId } } : undefined,
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        status: true,
        calendarSyncFailedAt: true,
        jobApplication: { select: { candidate: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { calendarSyncFailedAt: 'desc' },
    });
  }

  /**
   * Release IG.1, Checkpoint T — the Teams-sync equivalent of
   * findWithFailedCalendarSync above; same shape, same entityId path,
   * same "needs attention" role for the widget/endpoint pair.
   */
  findWithFailedTeamsSync(entityId?: string) {
    return this.prisma.interview.findMany({
      where: {
        teamsSyncFailedAt: { not: null },
        jobApplication: entityId ? { vacancy: { entityId } } : undefined,
      },
      select: {
        id: true,
        title: true,
        scheduledAt: true,
        status: true,
        teamsSyncFailedAt: true,
        jobApplication: { select: { candidate: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { teamsSyncFailedAt: 'desc' },
    });
  }

  /**
   * Release IG.1, Checkpoint T — manual retry for an interview sitting in
   * `teamsSyncFailedAt`, mirroring retryCalendarSync's own two-shape
   * structure but narrower: TeamsProvider has no updateMeeting (see
   * teams-provider.interface.ts), so there is no third "retry an update"
   * case — only "the create never succeeded" or "a later cancel failed".
   *
   *  - No `teamsMeetingId` yet -> the original createMeeting never
   *    succeeded. Re-run the exact same `trySyncTeamsMeeting` path
   *    `schedule()` uses; a repeat failure re-marks the flag internally
   *    (via trySyncTeamsMeeting's own catch) rather than throwing, same
   *    best-effort contract `schedule()` itself has.
   *  - `teamsMeetingId` already exists -> the create worked and a later
   *    cancelMeeting call failed (the only other call site that can set
   *    this flag). Retry the cancel; a repeat failure IS surfaced as a
   *    ConflictException, same reasoning retryCalendarSync's own update/
   *    cancel retry branch gives for why this direct action can't be
   *    silently swallowed the way the best-effort paths are.
   */
  async retryTeamsSync(id: string) {
    const existing = await this.findOne(id);
    if (!existing.teamsSyncFailedAt) {
      throw new BadRequestException(`Interview ${id} has no failed Teams sync to retry`);
    }

    if (!existing.teamsMeetingId) {
      const interviewers = existing.interviewers as { employeeId: string }[];
      const synced = await this.trySyncTeamsMeeting(id, {
        title: existing.title,
        startTime: existing.scheduledAt,
        durationMinutes: existing.durationMinutes,
        location: existing.location ?? undefined,
        interviewerEmployeeIds: interviewers.map((p) => p.employeeId),
      });
      return synced ?? existing;
    }

    const organizerIdentifier = await this.resolveTeamsOrganizer(
      existing.interviewers as Array<{ employeeId: string; employee?: { workEmail: string | null } }>,
    );
    if (!organizerIdentifier) {
      throw new ConflictException(`Cannot retry Teams sync for interview ${id}: no interviewer has a workEmail on file`);
    }

    try {
      const provider = this.teamsProviders.get(existing.teamsProviderCode!);
      await provider.cancelMeeting({ providerMeetingId: existing.teamsMeetingId, organizerIdentifier });
      return await this.prisma.interview.update({ where: { id }, data: { teamsSyncFailedAt: null } });
    } catch (err) {
      await this.tryMarkTeamsSyncFailed(id);
      throw new ConflictException(`Teams sync retry failed for interview ${id}: ${(err as Error).message}`);
    }
  }

  /**
   * Release IG.1, Checkpoint P — the first real caller of PresenceProviderRegistry
   * (presence-provider.interface.ts's own doc comment named this exact
   * decision as deferred to "whichever checkpoint after this one adds
   * the first real caller"). A recruiter opening an interview's detail
   * screen can now see whether each panelist is currently online before
   * deciding whether to reschedule around a likely-unavailable interviewer.
   *
   * userIdentifier resolution: employee.workEmail, same join key
   * ContactsProvider/CalendarProvider already use for their own Graph
   * correlation (see presence-provider.interface.ts's design notes).
   * Panelists without a workEmail on file are returned with a null
   * presence rather than being dropped from the list, so the UI can
   * still show "presence unavailable" against a name instead of
   * silently omitting a panelist.
   *
   * Best-effort per panelist, same posture InterviewService.schedule()
   * takes toward calendar sync: one interviewer's Graph lookup failing
   * (token issue, missing Presence.Read.All grant, throttling) must
   * never fail the whole request or hide the other panelists' presence.
   * Failures are logged and surfaced as presence: null + presenceError,
   * not thrown.
   */
  async interviewerPresence(id: string): Promise<
    Array<{ employeeId: string; firstName: string; lastName: string; workEmail: string | null; presence: PresenceResult | null; presenceError?: string }>
  > {
    const interview = await this.findOne(id);

    if (!this.presenceProviders.isRegistered(MS_GRAPH_PRESENCE_PROVIDER_CODE)) {
      return interview.interviewers.map((panelist) => ({
        employeeId: panelist.employeeId,
        firstName: panelist.employee.firstName,
        lastName: panelist.employee.lastName,
        workEmail: panelist.employee.workEmail ?? null,
        presence: null,
        presenceError: 'No presence provider registered',
      }));
    }

    const provider = this.presenceProviders.get(MS_GRAPH_PRESENCE_PROVIDER_CODE);

    return Promise.all(
      interview.interviewers.map(async (panelist) => {
        const workEmail = panelist.employee.workEmail ?? null;
        const base = {
          employeeId: panelist.employeeId,
          firstName: panelist.employee.firstName,
          lastName: panelist.employee.lastName,
          workEmail,
        };
        if (!workEmail) {
          return { ...base, presence: null, presenceError: 'Employee has no workEmail on file' };
        }
        try {
          const presence = await provider.getPresence(workEmail);
          return { ...base, presence };
        } catch (err) {
          this.logger.warn(`Presence lookup failed for panelist ${panelist.employeeId} on interview ${id}: ${(err as Error).message}`);
          return { ...base, presence: null, presenceError: (err as Error).message };
        }
      }),
    );
  }

  // -------------------------------------------------------------------
  // FEEDBACK & SCORING
  // -------------------------------------------------------------------

  async submitFeedback(dto: SubmitFeedbackDto) {
    if (dto.rating < 1 || dto.rating > 5) throw new BadRequestException('rating must be between 1 and 5');
    const interview = await this.findOne(dto.interviewId);
    const isPanelist = interview.interviewers.some((p) => p.employeeId === dto.employeeId);
    if (!isPanelist) throw new ConflictException('Only assigned panelists can submit feedback for this interview');

    const existing = await this.prisma.interviewFeedback.findUnique({
      where: { interviewId_employeeId: { interviewId: dto.interviewId, employeeId: dto.employeeId } },
    });
    if (existing) throw new ConflictException('Feedback already submitted by this interviewer');

    const feedback = await this.prisma.interviewFeedback.create({ data: dto });

    // Auto-complete the interview once every panelist has submitted feedback.
    const allFeedback = await this.prisma.interviewFeedback.count({ where: { interviewId: dto.interviewId } });
    if (allFeedback >= interview.interviewers.length) {
      await this.prisma.interview.update({ where: { id: dto.interviewId }, data: { status: InterviewStatus.COMPLETED } });
    }

    return feedback;
  }

  findFeedback(interviewId: string) {
    return this.prisma.interviewFeedback.findMany({ where: { interviewId }, include: { employee: true } });
  }

  /** Average interview rating across all completed interviews for an application — used for candidate scoring. */
  async averageRatingForApplication(jobApplicationId: string): Promise<number | null> {
    const feedback = await this.prisma.interviewFeedback.findMany({
      where: { interview: { jobApplicationId } },
      select: { rating: true },
    });
    if (feedback.length === 0) return null;
    return Math.round((feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length) * 100) / 100;
  }
}
