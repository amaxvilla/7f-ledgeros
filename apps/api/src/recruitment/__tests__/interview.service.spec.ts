import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationStage, InterviewRecommendation, InterviewStatus } from '@prisma/client';
import { InterviewService } from '../interview.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarProviderRegistry } from '../../calendar/calendar-provider.registry';
import { MS_GRAPH_CALENDAR_PROVIDER_CODE } from '../../calendar/providers/microsoft-graph-calendar.provider';
import { PresenceProviderRegistry } from '../../presence/presence-provider.registry';
import { MS_GRAPH_PRESENCE_PROVIDER_CODE } from '../../presence/providers/microsoft-graph-presence.provider';
import { TeamsProviderRegistry } from '../../teams/teams-provider.registry';
import { MS_GRAPH_TEAMS_PROVIDER_CODE } from '../../teams/providers/microsoft-teams.provider';

function buildPrismaMock() {
  return {
    jobApplication: { findUnique: jest.fn(), update: jest.fn() },
    interview: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
    interviewFeedback: { findUnique: jest.fn(), create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    employee: { findMany: jest.fn() },
  };
}

function buildCalendarRegistryMock() {
  return { isRegistered: jest.fn(), get: jest.fn() };
}

function buildPresenceRegistryMock() {
  return { isRegistered: jest.fn(), get: jest.fn() };
}

function buildTeamsRegistryMock() {
  return { isRegistered: jest.fn(), get: jest.fn() };
}

describe('InterviewService', () => {
  let service: InterviewService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let calendarRegistry: ReturnType<typeof buildCalendarRegistryMock>;
  let presenceRegistry: ReturnType<typeof buildPresenceRegistryMock>;
  let teamsRegistry: ReturnType<typeof buildTeamsRegistryMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    calendarRegistry = buildCalendarRegistryMock();
    presenceRegistry = buildPresenceRegistryMock();
    teamsRegistry = buildTeamsRegistryMock();
    // Default: no calendar provider registered — most tests aren't about
    // calendar sync, so they should be unaffected by it (trySyncCreate's
    // own first line short-circuits on this).
    calendarRegistry.isRegistered.mockReturnValue(false);
    // Default: no presence provider registered — same reasoning, most
    // tests aren't about interviewerPresence().
    presenceRegistry.isRegistered.mockReturnValue(false);
    // Default: no Teams provider registered — same reasoning, most tests
    // aren't about video-call interviews (trySyncTeamsMeeting's own
    // isRegistered check short-circuits on this).
    teamsRegistry.isRegistered.mockReturnValue(false);
    const moduleRef = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: PrismaService, useValue: prisma },
        { provide: CalendarProviderRegistry, useValue: calendarRegistry },
        { provide: PresenceProviderRegistry, useValue: presenceRegistry },
        { provide: TeamsProviderRegistry, useValue: teamsRegistry },
      ],
    }).compile();
    service = moduleRef.get(InterviewService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('schedule', () => {
    it('rejects scheduling with no interviewers', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.APPLIED });
      await expect(
        service.schedule({
          jobApplicationId: 'app1',
          title: 'Tech screen',
          scheduledAt: '2026-08-01T10:00:00Z',
          interviewerEmployeeIds: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for an unknown application', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue(null);
      await expect(
        service.schedule({
          jobApplicationId: 'missing',
          title: 'Tech screen',
          scheduledAt: '2026-08-01T10:00:00Z',
          interviewerEmployeeIds: ['e1'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the interview and advances the application to INTERVIEW', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});

      const result: any = await service.schedule({
        jobApplicationId: 'app1',
        title: 'Tech screen',
        scheduledAt: '2026-08-01T10:00:00Z',
        interviewerEmployeeIds: ['e1', 'e2'],
      });

      expect(result.status).toBe(InterviewStatus.SCHEDULED);
      expect(prisma.jobApplication.update).toHaveBeenCalledWith({
        where: { id: 'app1' },
        data: { stage: ApplicationStage.INTERVIEW },
      });
    });
  });

  describe('calendar sync', () => {
    function baseScheduleDto() {
      return {
        jobApplicationId: 'app1',
        title: 'Tech screen',
        scheduledAt: '2026-08-01T10:00:00Z',
        interviewerEmployeeIds: ['e1', 'e2'],
      };
    }

    it('schedule() does not touch the calendar provider when none is registered', async () => {
      calendarRegistry.isRegistered.mockReturnValue(false);
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED, candidate: { email: 'cand@example.com' } });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});

      const result: any = await service.schedule(baseScheduleDto());

      expect(calendarRegistry.get).not.toHaveBeenCalled();
      expect(result.calendarEventId).toBeUndefined();
    });

    it('schedule() creates a calendar event with the candidate and panelist emails, and stores the result', async () => {
      calendarRegistry.isRegistered.mockReturnValue(true);
      const createEvent = jest.fn().mockResolvedValue({ providerEventId: 'evt-1', htmlLink: 'https://graph/evt-1' });
      calendarRegistry.get.mockReturnValue({ createEvent });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED, candidate: { email: 'cand@example.com' } });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      prisma.employee.findMany.mockResolvedValue([{ workEmail: 'e1@example.com' }, { workEmail: null }]);
      prisma.interview.update.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));

      const result: any = await service.schedule(baseScheduleDto());

      expect(calendarRegistry.get).toHaveBeenCalledWith(MS_GRAPH_CALENDAR_PROVIDER_CODE);
      expect(createEvent).toHaveBeenCalledWith(
        expect.objectContaining({ attendeeEmails: ['cand@example.com', 'e1@example.com'] }),
      );
      expect(result.calendarEventId).toBe('evt-1');
      expect(result.calendarProviderCode).toBe(MS_GRAPH_CALENDAR_PROVIDER_CODE);
      expect(prisma.interview.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ calendarSyncFailedAt: null }) }),
      );
    });

    it('schedule() still returns the interview if calendar event creation fails, and records the failure', async () => {
      calendarRegistry.isRegistered.mockReturnValue(true);
      const createEvent = jest.fn().mockRejectedValue(new Error('Graph 403'));
      calendarRegistry.get.mockReturnValue({ createEvent });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED, candidate: { email: 'cand@example.com' } });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.interview.update.mockResolvedValue({ id: 'int1' });

      const result: any = await service.schedule(baseScheduleDto());

      expect(result.id).toBe('int1');
      expect(result.calendarEventId).toBeUndefined();
      // The only interview.update call should be the failure-flag write —
      // creation itself failed, so no calendarEventId/providerCode update.
      expect(prisma.interview.update).toHaveBeenCalledTimes(1);
      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: 'int1' },
        data: { calendarSyncFailedAt: expect.any(Date) },
      });
    });

    it('schedule() does not throw if persisting the failure flag itself fails', async () => {
      calendarRegistry.isRegistered.mockReturnValue(true);
      calendarRegistry.get.mockReturnValue({ createEvent: jest.fn().mockRejectedValue(new Error('Graph 403')) });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED, candidate: { email: 'cand@example.com' } });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.interview.update.mockRejectedValue(new Error('DB down'));

      await expect(service.schedule(baseScheduleDto())).resolves.toMatchObject({ id: 'int1' });
    });

    it('reschedule() updates the linked calendar event when one exists', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', scheduledAt: new Date('2026-08-02T10:00:00Z'), durationMinutes: 60 });
      const updateEvent = jest.fn().mockResolvedValue(undefined);
      calendarRegistry.get.mockReturnValue({ updateEvent });

      await service.reschedule('int1', { scheduledAt: '2026-08-02T10:00:00Z', location: 'Room 2' });

      expect(calendarRegistry.get).toHaveBeenCalledWith(MS_GRAPH_CALENDAR_PROVIDER_CODE);
      expect(updateEvent).toHaveBeenCalledWith(expect.objectContaining({ providerEventId: 'evt-1', location: 'Room 2' }));
    });

    it('reschedule() does not throw if the calendar update fails', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', scheduledAt: new Date('2026-08-02T10:00:00Z'), durationMinutes: 60 });
      calendarRegistry.get.mockReturnValue({ updateEvent: jest.fn().mockRejectedValue(new Error('Graph down')) });

      await expect(service.reschedule('int1', { scheduledAt: '2026-08-02T10:00:00Z' })).resolves.toBeDefined();
    });

    it('cancel() cancels the linked calendar event when one exists', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', status: InterviewStatus.CANCELLED });
      const cancelEvent = jest.fn().mockResolvedValue(undefined);
      calendarRegistry.get.mockReturnValue({ cancelEvent });

      await service.cancel('int1');

      expect(cancelEvent).toHaveBeenCalledWith(expect.objectContaining({ providerEventId: 'evt-1' }));
    });

    it('reschedule() clears a previously-set failure flag once the update succeeds', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        calendarSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', scheduledAt: new Date('2026-08-02T10:00:00Z'), durationMinutes: 60 });
      calendarRegistry.get.mockReturnValue({ updateEvent: jest.fn().mockResolvedValue(undefined) });

      await service.reschedule('int1', { scheduledAt: '2026-08-02T10:00:00Z' });

      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { calendarSyncFailedAt: null } });
    });

    it('reschedule() records a failure flag when the calendar update fails', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        calendarSyncFailedAt: null,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', scheduledAt: new Date('2026-08-02T10:00:00Z'), durationMinutes: 60 });
      calendarRegistry.get.mockReturnValue({ updateEvent: jest.fn().mockRejectedValue(new Error('Graph down')) });

      await service.reschedule('int1', { scheduledAt: '2026-08-02T10:00:00Z' });

      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { calendarSyncFailedAt: expect.any(Date) } });
    });

    it('cancel() skips the calendar provider when the interview never got a calendar event', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: null,
        calendarProviderCode: null,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', status: InterviewStatus.CANCELLED });

      await service.cancel('int1');

      expect(calendarRegistry.get).not.toHaveBeenCalled();
    });

    it('cancel() records a failure flag when the calendar cancel fails', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', status: InterviewStatus.CANCELLED });
      calendarRegistry.get.mockReturnValue({ cancelEvent: jest.fn().mockRejectedValue(new Error('Graph down')) });

      await service.cancel('int1');

      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { calendarSyncFailedAt: expect.any(Date) } });
    });
  });

  describe('teams sync', () => {
    function baseVideoCallDto() {
      return {
        jobApplicationId: 'app1',
        title: 'Tech screen',
        scheduledAt: '2026-08-01T10:00:00Z',
        location: 'video-call',
        interviewerEmployeeIds: ['e1', 'e2'],
      };
    }

    it('schedule() does not touch the Teams provider for a non-video-call interview', async () => {
      teamsRegistry.isRegistered.mockReturnValue(true);
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});

      const result: any = await service.schedule({
        jobApplicationId: 'app1',
        title: 'Tech screen',
        scheduledAt: '2026-08-01T10:00:00Z',
        location: 'Room 2',
        interviewerEmployeeIds: ['e1'],
      });

      expect(teamsRegistry.get).not.toHaveBeenCalled();
      expect(result.teamsJoinUrl).toBeUndefined();
    });

    it('schedule() does not touch the Teams provider when none is registered, even for a video-call interview', async () => {
      teamsRegistry.isRegistered.mockReturnValue(false);
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});

      const result: any = await service.schedule(baseVideoCallDto());

      expect(teamsRegistry.get).not.toHaveBeenCalled();
      expect(result.teamsJoinUrl).toBeUndefined();
    });

    it('schedule() creates a Teams meeting organized by the first interviewer with a workEmail, and stores the result', async () => {
      teamsRegistry.isRegistered.mockReturnValue(true);
      const createMeeting = jest.fn().mockResolvedValue({ providerMeetingId: 'meeting-1', joinUrl: 'https://teams/join/1' });
      teamsRegistry.get.mockReturnValue({ createMeeting });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      // e1 has no workEmail — e2 is the first WITH one, so e2 organizes.
      prisma.employee.findMany.mockResolvedValue([
        { id: 'e1', workEmail: null },
        { id: 'e2', workEmail: 'e2@example.com' },
      ]);
      prisma.interview.update.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));

      const result: any = await service.schedule(baseVideoCallDto());

      expect(teamsRegistry.get).toHaveBeenCalledWith(MS_GRAPH_TEAMS_PROVIDER_CODE);
      expect(createMeeting).toHaveBeenCalledWith(expect.objectContaining({ organizerIdentifier: 'e2@example.com', subject: 'Tech screen' }));
      expect(result.teamsMeetingId).toBe('meeting-1');
      expect(result.teamsJoinUrl).toBe('https://teams/join/1');
      expect(result.teamsProviderCode).toBe(MS_GRAPH_TEAMS_PROVIDER_CODE);
    });

    it('schedule() skips the Teams meeting (without throwing) when no interviewer has a workEmail on file', async () => {
      teamsRegistry.isRegistered.mockReturnValue(true);
      const createMeeting = jest.fn();
      teamsRegistry.get.mockReturnValue({ createMeeting });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      prisma.employee.findMany.mockResolvedValue([{ id: 'e1', workEmail: null }, { id: 'e2', workEmail: null }]);

      const result: any = await service.schedule(baseVideoCallDto());

      expect(createMeeting).not.toHaveBeenCalled();
      expect(result.teamsJoinUrl).toBeUndefined();
    });

    it('schedule() still returns the interview if Teams meeting creation fails, and records a teamsSyncFailedAt flag (Checkpoint T)', async () => {
      teamsRegistry.isRegistered.mockReturnValue(true);
      teamsRegistry.get.mockReturnValue({ createMeeting: jest.fn().mockRejectedValue(new Error('Graph 403')) });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      prisma.employee.findMany.mockResolvedValue([{ id: 'e1', workEmail: 'e1@example.com' }]);
      prisma.interview.update.mockResolvedValue({ id: 'int1' });

      const result: any = await service.schedule(baseVideoCallDto());

      expect(result.id).toBe('int1');
      expect(result.teamsJoinUrl).toBeUndefined();
      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: 'int1' },
        data: { teamsSyncFailedAt: expect.any(Date) },
      });
    });

    it('schedule() does not throw if persisting the Teams-sync failure flag itself fails', async () => {
      teamsRegistry.isRegistered.mockReturnValue(true);
      teamsRegistry.get.mockReturnValue({ createMeeting: jest.fn().mockRejectedValue(new Error('Graph 403')) });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      prisma.employee.findMany.mockResolvedValue([{ id: 'e1', workEmail: 'e1@example.com' }]);
      prisma.interview.update.mockRejectedValue(new Error('DB down'));

      await expect(service.schedule(baseVideoCallDto())).resolves.toMatchObject({ id: 'int1' });
    });

    it('schedule() clears a previously-set teamsSyncFailedAt flag once the Teams meeting create succeeds', async () => {
      teamsRegistry.isRegistered.mockReturnValue(true);
      const createMeeting = jest.fn().mockResolvedValue({ providerMeetingId: 'meeting-1', joinUrl: 'https://teams/join/1' });
      teamsRegistry.get.mockReturnValue({ createMeeting });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', stage: ApplicationStage.SHORTLISTED });
      prisma.interview.create.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      prisma.employee.findMany.mockResolvedValue([{ id: 'e1', workEmail: 'e1@example.com' }]);
      prisma.interview.update.mockImplementation(({ data }: any) => ({ id: 'int1', ...data }));

      const result: any = await service.schedule(baseVideoCallDto());

      expect(prisma.interview.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teamsSyncFailedAt: null }) }),
      );
      expect(result.teamsMeetingId).toBe('meeting-1');
    });

    it('cancel() records a teamsSyncFailedAt flag when the Teams cancel fails (Checkpoint T)', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: null,
        calendarProviderCode: null,
        teamsMeetingId: 'meeting-1',
        teamsProviderCode: MS_GRAPH_TEAMS_PROVIDER_CODE,
        interviewers: [{ employeeId: 'e1', employee: { workEmail: 'e1@example.com' } }],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', status: InterviewStatus.CANCELLED });
      teamsRegistry.get.mockReturnValue({ cancelMeeting: jest.fn().mockRejectedValue(new Error('Graph down')) });

      await service.cancel('int1');

      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { teamsSyncFailedAt: expect.any(Date) } });
    });

    it('cancel() cancels the linked Teams meeting when one exists, organized by the first panelist with a workEmail', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: null,
        calendarProviderCode: null,
        teamsMeetingId: 'meeting-1',
        teamsProviderCode: MS_GRAPH_TEAMS_PROVIDER_CODE,
        interviewers: [{ employeeId: 'e1', employee: { workEmail: null } }, { employeeId: 'e2', employee: { workEmail: 'e2@example.com' } }],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', status: InterviewStatus.CANCELLED });
      const cancelMeeting = jest.fn().mockResolvedValue(undefined);
      teamsRegistry.get.mockReturnValue({ cancelMeeting });

      await service.cancel('int1');

      expect(teamsRegistry.get).toHaveBeenCalledWith(MS_GRAPH_TEAMS_PROVIDER_CODE);
      expect(cancelMeeting).toHaveBeenCalledWith({ providerMeetingId: 'meeting-1', organizerIdentifier: 'e2@example.com' });
    });

    it('cancel() skips the Teams provider when the interview never got a Teams meeting', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: null,
        calendarProviderCode: null,
        teamsMeetingId: null,
        teamsProviderCode: null,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', status: InterviewStatus.CANCELLED });

      await service.cancel('int1');

      expect(teamsRegistry.get).not.toHaveBeenCalled();
    });

    it('cancel() does not throw if the Teams cancel fails', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarEventId: null,
        calendarProviderCode: null,
        teamsMeetingId: 'meeting-1',
        teamsProviderCode: MS_GRAPH_TEAMS_PROVIDER_CODE,
        interviewers: [{ employeeId: 'e1', employee: { workEmail: 'e1@example.com' } }],
        feedback: [],
        jobApplication: {},
      });
      prisma.interview.update.mockResolvedValue({ id: 'int1', status: InterviewStatus.CANCELLED });
      teamsRegistry.get.mockReturnValue({ cancelMeeting: jest.fn().mockRejectedValue(new Error('Graph down')) });

      await expect(service.cancel('int1')).resolves.toMatchObject({ id: 'int1' });
    });
  });

  describe('retryCalendarSync', () => {
    it('throws BadRequestException when there is no failure flag to retry', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        calendarSyncFailedAt: null,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });

      await expect(service.retryCalendarSync('int1')).rejects.toThrow(BadRequestException);
    });

    it('re-runs the create sync when the original create never succeeded', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-01T10:00:00Z'),
        durationMinutes: 60,
        location: null,
        status: InterviewStatus.SCHEDULED,
        calendarEventId: null,
        calendarProviderCode: null,
        calendarSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [{ employeeId: 'e1' }],
        feedback: [],
        jobApplication: { candidate: { email: 'candidate@example.com' } },
      });
      calendarRegistry.isRegistered.mockReturnValue(true);
      prisma.employee.findMany.mockResolvedValue([{ workEmail: 'e1@example.com' }]);
      const createEvent = jest.fn().mockResolvedValue({ providerEventId: 'evt-new' });
      calendarRegistry.get.mockReturnValue({ createEvent });
      prisma.interview.update.mockResolvedValue({ id: 'int1', calendarEventId: 'evt-new' });

      const result: any = await service.retryCalendarSync('int1');

      expect(createEvent).toHaveBeenCalled();
      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: 'int1' },
        data: { calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE, calendarEventId: 'evt-new', calendarSyncFailedAt: null },
      });
      expect(result.calendarEventId).toBe('evt-new');
    });

    it('returns the unsynced interview if a create retry fails again, without throwing', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-01T10:00:00Z'),
        durationMinutes: 60,
        location: null,
        status: InterviewStatus.SCHEDULED,
        calendarEventId: null,
        calendarProviderCode: null,
        calendarSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      calendarRegistry.isRegistered.mockReturnValue(true);
      prisma.employee.findMany.mockResolvedValue([]);
      calendarRegistry.get.mockReturnValue({ createEvent: jest.fn().mockRejectedValue(new Error('Graph down')) });

      const result: any = await service.retryCalendarSync('int1');

      expect(result.id).toBe('int1');
    });

    it('retries the update call and clears the flag when the interview is still active', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-02T10:00:00Z'),
        durationMinutes: 60,
        location: 'Room 2',
        status: InterviewStatus.RESCHEDULED,
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        calendarSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      const updateEvent = jest.fn().mockResolvedValue(undefined);
      calendarRegistry.get.mockReturnValue({ updateEvent });
      prisma.interview.update.mockResolvedValue({ id: 'int1', calendarSyncFailedAt: null });

      await service.retryCalendarSync('int1');

      expect(updateEvent).toHaveBeenCalledWith(expect.objectContaining({ providerEventId: 'evt-1', location: 'Room 2' }));
      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { calendarSyncFailedAt: null } });
    });

    it('retries the cancel call and clears the flag when the interview is cancelled', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-02T10:00:00Z'),
        durationMinutes: 60,
        location: null,
        status: InterviewStatus.CANCELLED,
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        calendarSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      const cancelEvent = jest.fn().mockResolvedValue(undefined);
      calendarRegistry.get.mockReturnValue({ cancelEvent });
      prisma.interview.update.mockResolvedValue({ id: 'int1', calendarSyncFailedAt: null });

      await service.retryCalendarSync('int1');

      expect(cancelEvent).toHaveBeenCalledWith(expect.objectContaining({ providerEventId: 'evt-1' }));
      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { calendarSyncFailedAt: null } });
    });

    it('re-marks the flag and throws ConflictException when the update retry fails again', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-02T10:00:00Z'),
        durationMinutes: 60,
        location: null,
        status: InterviewStatus.RESCHEDULED,
        calendarEventId: 'evt-1',
        calendarProviderCode: MS_GRAPH_CALENDAR_PROVIDER_CODE,
        calendarSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      calendarRegistry.get.mockReturnValue({ updateEvent: jest.fn().mockRejectedValue(new Error('Graph down again')) });
      prisma.interview.update.mockResolvedValue({ id: 'int1', calendarSyncFailedAt: new Date() });

      await expect(service.retryCalendarSync('int1')).rejects.toThrow(ConflictException);
      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { calendarSyncFailedAt: expect.any(Date) } });
    });
  });

  describe('findWithFailedCalendarSync', () => {
    it('filters on calendarSyncFailedAt not null, optionally scoped to an entity', async () => {
      prisma.interview.findMany.mockResolvedValue([{ id: 'int1', calendarSyncFailedAt: new Date() }]);

      const result = await service.findWithFailedCalendarSync('ent-1');

      expect(prisma.interview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { calendarSyncFailedAt: { not: null }, jobApplication: { vacancy: { entityId: 'ent-1' } } },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('omits the entity filter when no entityId is given', async () => {
      prisma.interview.findMany.mockResolvedValue([]);

      await service.findWithFailedCalendarSync();

      expect(prisma.interview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { calendarSyncFailedAt: { not: null }, jobApplication: undefined } }),
      );
    });
  });

  describe('retryTeamsSync', () => {
    it('throws BadRequestException when there is no Teams-sync failure flag to retry', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        teamsSyncFailedAt: null,
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });

      await expect(service.retryTeamsSync('int1')).rejects.toThrow(BadRequestException);
    });

    it('re-runs the Teams meeting create when the original create never succeeded', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-01T10:00:00Z'),
        durationMinutes: 60,
        location: 'video-call',
        status: InterviewStatus.SCHEDULED,
        teamsMeetingId: null,
        teamsProviderCode: null,
        teamsSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [{ employeeId: 'e1' }],
        feedback: [],
        jobApplication: {},
      });
      teamsRegistry.isRegistered.mockReturnValue(true);
      prisma.employee.findMany.mockResolvedValue([{ id: 'e1', workEmail: 'e1@example.com' }]);
      const createMeeting = jest.fn().mockResolvedValue({ providerMeetingId: 'meeting-new', joinUrl: 'https://teams/join/new' });
      teamsRegistry.get.mockReturnValue({ createMeeting });
      prisma.interview.update.mockResolvedValue({ id: 'int1', teamsMeetingId: 'meeting-new' });

      const result: any = await service.retryTeamsSync('int1');

      expect(createMeeting).toHaveBeenCalledWith(expect.objectContaining({ organizerIdentifier: 'e1@example.com' }));
      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: 'int1' },
        data: {
          teamsProviderCode: MS_GRAPH_TEAMS_PROVIDER_CODE,
          teamsMeetingId: 'meeting-new',
          teamsJoinUrl: 'https://teams/join/new',
          teamsSyncFailedAt: null,
        },
      });
      expect(result.teamsMeetingId).toBe('meeting-new');
    });

    it('returns the unsynced interview if a create retry fails again, without throwing', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-01T10:00:00Z'),
        durationMinutes: 60,
        location: 'video-call',
        status: InterviewStatus.SCHEDULED,
        teamsMeetingId: null,
        teamsProviderCode: null,
        teamsSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [],
        feedback: [],
        jobApplication: {},
      });
      teamsRegistry.isRegistered.mockReturnValue(true);
      prisma.employee.findMany.mockResolvedValue([]);
      teamsRegistry.get.mockReturnValue({ createMeeting: jest.fn().mockRejectedValue(new Error('Graph down')) });

      const result: any = await service.retryTeamsSync('int1');

      expect(result.id).toBe('int1');
    });

    it('retries the cancel call and clears the flag when the interview is cancelled', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-02T10:00:00Z'),
        durationMinutes: 60,
        location: 'video-call',
        status: InterviewStatus.CANCELLED,
        teamsMeetingId: 'meeting-1',
        teamsProviderCode: MS_GRAPH_TEAMS_PROVIDER_CODE,
        teamsSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [{ employeeId: 'e1', employee: { workEmail: 'e1@example.com' } }],
        feedback: [],
        jobApplication: {},
      });
      const cancelMeeting = jest.fn().mockResolvedValue(undefined);
      teamsRegistry.get.mockReturnValue({ cancelMeeting });
      prisma.interview.update.mockResolvedValue({ id: 'int1', teamsSyncFailedAt: null });

      await service.retryTeamsSync('int1');

      expect(cancelMeeting).toHaveBeenCalledWith({ providerMeetingId: 'meeting-1', organizerIdentifier: 'e1@example.com' });
      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { teamsSyncFailedAt: null } });
    });

    it('throws ConflictException without calling the provider when no interviewer has a workEmail on file', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-02T10:00:00Z'),
        durationMinutes: 60,
        location: 'video-call',
        status: InterviewStatus.CANCELLED,
        teamsMeetingId: 'meeting-1',
        teamsProviderCode: MS_GRAPH_TEAMS_PROVIDER_CODE,
        teamsSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [{ employeeId: 'e1', employee: { workEmail: null } }],
        feedback: [],
        jobApplication: {},
      });

      await expect(service.retryTeamsSync('int1')).rejects.toThrow(ConflictException);
      expect(teamsRegistry.get).not.toHaveBeenCalled();
    });

    it('re-marks the flag and throws ConflictException when the cancel retry fails again', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        title: 'Tech screen',
        scheduledAt: new Date('2026-08-02T10:00:00Z'),
        durationMinutes: 60,
        location: 'video-call',
        status: InterviewStatus.CANCELLED,
        teamsMeetingId: 'meeting-1',
        teamsProviderCode: MS_GRAPH_TEAMS_PROVIDER_CODE,
        teamsSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
        interviewers: [{ employeeId: 'e1', employee: { workEmail: 'e1@example.com' } }],
        feedback: [],
        jobApplication: {},
      });
      teamsRegistry.get.mockReturnValue({ cancelMeeting: jest.fn().mockRejectedValue(new Error('Graph down again')) });
      prisma.interview.update.mockResolvedValue({ id: 'int1', teamsSyncFailedAt: new Date() });

      await expect(service.retryTeamsSync('int1')).rejects.toThrow(ConflictException);
      expect(prisma.interview.update).toHaveBeenCalledWith({ where: { id: 'int1' }, data: { teamsSyncFailedAt: expect.any(Date) } });
    });
  });

  describe('findWithFailedTeamsSync', () => {
    it('filters on teamsSyncFailedAt not null, optionally scoped to an entity', async () => {
      prisma.interview.findMany.mockResolvedValue([{ id: 'int1', teamsSyncFailedAt: new Date() }]);

      const result = await service.findWithFailedTeamsSync('ent-1');

      expect(prisma.interview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { teamsSyncFailedAt: { not: null }, jobApplication: { vacancy: { entityId: 'ent-1' } } },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('omits the entity filter when no entityId is given', async () => {
      prisma.interview.findMany.mockResolvedValue([]);

      await service.findWithFailedTeamsSync();

      expect(prisma.interview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { teamsSyncFailedAt: { not: null }, jobApplication: undefined } }),
      );
    });
  });

  describe('submitFeedback', () => {
    it('rejects a rating outside 1-5', async () => {
      await expect(
        service.submitFeedback({
          interviewId: 'int1',
          employeeId: 'e1',
          rating: 9,
          recommendation: InterviewRecommendation.YES,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects feedback from a non-panelist', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        interviewers: [{ employeeId: 'other' }],
        feedback: [],
        jobApplication: {},
      });
      await expect(
        service.submitFeedback({
          interviewId: 'int1',
          employeeId: 'e1',
          rating: 4,
          recommendation: InterviewRecommendation.YES,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects duplicate feedback from the same panelist', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        interviewers: [{ employeeId: 'e1' }],
        feedback: [],
        jobApplication: {},
      });
      prisma.interviewFeedback.findUnique.mockResolvedValue({ id: 'fb1' });
      await expect(
        service.submitFeedback({
          interviewId: 'int1',
          employeeId: 'e1',
          rating: 4,
          recommendation: InterviewRecommendation.YES,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('auto-completes the interview once all panelists have submitted feedback', async () => {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        interviewers: [{ employeeId: 'e1' }],
        feedback: [],
        jobApplication: {},
      });
      prisma.interviewFeedback.findUnique.mockResolvedValue(null);
      prisma.interviewFeedback.create.mockImplementation(({ data }: any) => ({ id: 'fb1', ...data }));
      prisma.interviewFeedback.count.mockResolvedValue(1);
      prisma.interview.update.mockResolvedValue({});

      await service.submitFeedback({
        interviewId: 'int1',
        employeeId: 'e1',
        rating: 4,
        recommendation: InterviewRecommendation.YES,
      });

      expect(prisma.interview.update).toHaveBeenCalledWith({
        where: { id: 'int1' },
        data: { status: InterviewStatus.COMPLETED },
      });
    });
  });

  describe('averageRatingForApplication', () => {
    it('returns null when there is no feedback yet', async () => {
      prisma.interviewFeedback.findMany.mockResolvedValue([]);
      const result = await service.averageRatingForApplication('app1');
      expect(result).toBeNull();
    });

    it('averages ratings across feedback', async () => {
      prisma.interviewFeedback.findMany.mockResolvedValue([{ rating: 4 }, { rating: 5 }]);
      const result = await service.averageRatingForApplication('app1');
      expect(result).toBe(4.5);
    });
  });

  describe('interviewerPresence', () => {
    function mockInterviewWithPanelists(panelists: Array<{ employeeId: string; firstName: string; lastName: string; workEmail: string | null }>) {
      prisma.interview.findUnique.mockResolvedValue({
        id: 'int1',
        interviewers: panelists.map((p) => ({
          employeeId: p.employeeId,
          employee: { firstName: p.firstName, lastName: p.lastName, workEmail: p.workEmail },
        })),
        feedback: [],
        jobApplication: { candidate: {} },
      });
    }

    it('throws NotFoundException for an unknown interview', async () => {
      prisma.interview.findUnique.mockResolvedValue(null);
      await expect(service.interviewerPresence('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns presenceError for every panelist when no presence provider is registered', async () => {
      mockInterviewWithPanelists([{ employeeId: 'e1', firstName: 'Ada', lastName: 'Obi', workEmail: 'ada@7fc.com' }]);
      presenceRegistry.isRegistered.mockReturnValue(false);

      const result = await service.interviewerPresence('int1');

      expect(result).toEqual([
        { employeeId: 'e1', firstName: 'Ada', lastName: 'Obi', workEmail: 'ada@7fc.com', presence: null, presenceError: 'No presence provider registered' },
      ]);
    });

    it('returns presenceError instead of calling Graph for a panelist with no workEmail on file', async () => {
      mockInterviewWithPanelists([{ employeeId: 'e1', firstName: 'Chidi', lastName: 'Eze', workEmail: null }]);
      presenceRegistry.isRegistered.mockReturnValue(true);
      const provider = { getPresence: jest.fn() };
      presenceRegistry.get.mockReturnValue(provider);

      const result = await service.interviewerPresence('int1');

      expect(provider.getPresence).not.toHaveBeenCalled();
      expect(result).toEqual([
        { employeeId: 'e1', firstName: 'Chidi', lastName: 'Eze', workEmail: null, presence: null, presenceError: 'Employee has no workEmail on file' },
      ]);
    });

    it('looks up presence per panelist via workEmail when a provider is registered', async () => {
      mockInterviewWithPanelists([
        { employeeId: 'e1', firstName: 'Ada', lastName: 'Obi', workEmail: 'ada@7fc.com' },
        { employeeId: 'e2', firstName: 'Tunde', lastName: 'Bello', workEmail: 'tunde@7fc.com' },
      ]);
      presenceRegistry.isRegistered.mockReturnValue(true);
      const provider = {
        getPresence: jest.fn().mockImplementation((email: string) =>
          Promise.resolve(email === 'ada@7fc.com' ? { availability: 'Available', activity: 'Available' } : { availability: 'Busy', activity: 'InAMeeting' }),
        ),
      };
      presenceRegistry.get.mockReturnValue(provider);

      const result = await service.interviewerPresence('int1');

      expect(presenceRegistry.get).toHaveBeenCalledWith(MS_GRAPH_PRESENCE_PROVIDER_CODE);
      expect(provider.getPresence).toHaveBeenCalledWith('ada@7fc.com');
      expect(provider.getPresence).toHaveBeenCalledWith('tunde@7fc.com');
      expect(result).toEqual([
        { employeeId: 'e1', firstName: 'Ada', lastName: 'Obi', workEmail: 'ada@7fc.com', presence: { availability: 'Available', activity: 'Available' } },
        { employeeId: 'e2', firstName: 'Tunde', lastName: 'Bello', workEmail: 'tunde@7fc.com', presence: { availability: 'Busy', activity: 'InAMeeting' } },
      ]);
    });

    it('does not fail the whole request when one panelist Graph lookup throws', async () => {
      mockInterviewWithPanelists([
        { employeeId: 'e1', firstName: 'Ada', lastName: 'Obi', workEmail: 'ada@7fc.com' },
        { employeeId: 'e2', firstName: 'Tunde', lastName: 'Bello', workEmail: 'tunde@7fc.com' },
      ]);
      presenceRegistry.isRegistered.mockReturnValue(true);
      const provider = {
        getPresence: jest.fn().mockImplementation((email: string) =>
          email === 'ada@7fc.com' ? Promise.reject(new Error('HTTP 403 — Insufficient privileges')) : Promise.resolve({ availability: 'Away', activity: 'Away' }),
        ),
      };
      presenceRegistry.get.mockReturnValue(provider);

      const result = await service.interviewerPresence('int1');

      expect(result).toEqual([
        { employeeId: 'e1', firstName: 'Ada', lastName: 'Obi', workEmail: 'ada@7fc.com', presence: null, presenceError: 'HTTP 403 — Insufficient privileges' },
        { employeeId: 'e2', firstName: 'Tunde', lastName: 'Bello', workEmail: 'tunde@7fc.com', presence: { availability: 'Away', activity: 'Away' } },
      ]);
    });
  });
});
