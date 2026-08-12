import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ApplicationStage, VacancyStatus } from '@prisma/client';
import { CandidateService } from '../candidate.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ContactsProviderRegistry } from '../../contacts/contacts-provider.registry';
import { MS_GRAPH_CONTACTS_PROVIDER_CODE } from '../../contacts/providers/microsoft-graph-contacts.provider';
import { WorkspaceAdminProviderRegistry } from '../../workspace-admin/workspace-admin-provider.registry';
import { GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE } from '../../workspace-admin/providers/google-workspace-admin.provider';

function buildPrismaMock() {
  return {
    candidate: { upsert: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    candidateDocument: { create: jest.fn(), findMany: jest.fn() },
    vacancy: { findUnique: jest.fn() },
    jobApplication: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    employee: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
}

function buildContactsRegistryMock() {
  return { isRegistered: jest.fn(), get: jest.fn() };
}

function buildWorkspaceAdminRegistryMock() {
  return { isRegistered: jest.fn(), get: jest.fn() };
}

describe('CandidateService', () => {
  let service: CandidateService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let contactsRegistry: ReturnType<typeof buildContactsRegistryMock>;
  let workspaceAdminRegistry: ReturnType<typeof buildWorkspaceAdminRegistryMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    contactsRegistry = buildContactsRegistryMock();
    workspaceAdminRegistry = buildWorkspaceAdminRegistryMock();
    // Default: no contacts/workspace-admin provider registered — most
    // tests aren't about either sync, so they should be unaffected by
    // either (trySyncCreate's/trySyncCreateDirectoryUser's own first
    // line short-circuits on this).
    contactsRegistry.isRegistered.mockReturnValue(false);
    workspaceAdminRegistry.isRegistered.mockReturnValue(false);
    const moduleRef = await Test.createTestingModule({
      providers: [
        CandidateService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContactsProviderRegistry, useValue: contactsRegistry },
        { provide: WorkspaceAdminProviderRegistry, useValue: workspaceAdminRegistry },
      ],
    }).compile();
    service = moduleRef.get(CandidateService);
    prisma.$transaction.mockImplementation((fn: any) => fn(prisma));
  });

  afterEach(() => jest.clearAllMocks());

  describe('upsertCandidate', () => {
    it('rejects a missing email', async () => {
      await expect(service.upsertCandidate({ firstName: 'A', lastName: 'B', email: '' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does not attempt contact sync when updating an existing candidate', async () => {
      prisma.candidate.findUnique.mockResolvedValue({ id: 'c1', email: 'a@example.com' });
      prisma.candidate.upsert.mockResolvedValue({ id: 'c1', firstName: 'A', lastName: 'B', email: 'a@example.com', phone: null });

      await service.upsertCandidate({ firstName: 'A', lastName: 'B', email: 'a@example.com' });

      expect(contactsRegistry.isRegistered).not.toHaveBeenCalled();
      expect(prisma.candidate.update).not.toHaveBeenCalled();
    });

    it('skips contact sync for a new candidate when no provider is registered', async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);
      prisma.candidate.upsert.mockResolvedValue({ id: 'c1', firstName: 'A', lastName: 'B', email: 'a@example.com', phone: null });

      const result: any = await service.upsertCandidate({ firstName: 'A', lastName: 'B', email: 'a@example.com' });

      expect(contactsRegistry.isRegistered).toHaveBeenCalledWith(MS_GRAPH_CONTACTS_PROVIDER_CODE);
      expect(prisma.candidate.update).not.toHaveBeenCalled();
      expect(result.id).toBe('c1');
    });

    it('creates an Outlook contact for a new candidate and persists the provider id', async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);
      prisma.candidate.upsert.mockResolvedValue({
        id: 'c1',
        firstName: 'A',
        lastName: 'B',
        email: 'a@example.com',
        phone: '+1555',
      });
      contactsRegistry.isRegistered.mockReturnValue(true);
      const createContact = jest.fn().mockResolvedValue({ providerContactId: 'contact-1' });
      contactsRegistry.get.mockReturnValue({ createContact });
      prisma.candidate.update.mockResolvedValue({ id: 'c1', providerContactId: 'contact-1' });

      const result: any = await service.upsertCandidate({ firstName: 'A', lastName: 'B', email: 'a@example.com', phone: '+1555' });

      expect(createContact).toHaveBeenCalledWith({ displayName: 'A B', emailAddress: 'a@example.com', phoneNumber: '+1555' });
      expect(prisma.candidate.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { contactProviderCode: MS_GRAPH_CONTACTS_PROVIDER_CODE, providerContactId: 'contact-1', contactSyncFailedAt: null },
      });
      expect(result.providerContactId).toBe('contact-1');
    });

    it('falls back to the pre-sync candidate row and marks the failure flag when contact creation fails', async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);
      const created = { id: 'c1', firstName: 'A', lastName: 'B', email: 'a@example.com', phone: null };
      prisma.candidate.upsert.mockResolvedValue(created);
      contactsRegistry.isRegistered.mockReturnValue(true);
      contactsRegistry.get.mockReturnValue({ createContact: jest.fn().mockRejectedValue(new Error('Graph down')) });
      prisma.candidate.update.mockResolvedValue({ id: 'c1', contactSyncFailedAt: new Date() });

      const result: any = await service.upsertCandidate({ firstName: 'A', lastName: 'B', email: 'a@example.com' });

      expect(prisma.candidate.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { contactSyncFailedAt: expect.any(Date) } });
      expect(result).toBe(created);
    });

    it('pushes an edit through to an already-synced candidate\'s Outlook contact (Checkpoint J)', async () => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: 'c1',
        email: 'a@example.com',
        providerContactId: 'contact-1',
        contactProviderCode: MS_GRAPH_CONTACTS_PROVIDER_CODE,
        contactSyncFailedAt: null,
      });
      prisma.candidate.upsert.mockResolvedValue({ id: 'c1', firstName: 'A2', lastName: 'B', email: 'a@example.com', phone: '+1555' });
      const updateContact = jest.fn().mockResolvedValue(undefined);
      contactsRegistry.get.mockReturnValue({ updateContact });

      const result: any = await service.upsertCandidate({ firstName: 'A2', lastName: 'B', email: 'a@example.com', phone: '+1555' });

      expect(updateContact).toHaveBeenCalledWith({
        providerContactId: 'contact-1',
        displayName: 'A2 B',
        emailAddress: 'a@example.com',
        phoneNumber: '+1555',
      });
      expect(prisma.candidate.update).not.toHaveBeenCalled();
      expect(result.id).toBe('c1');
    });

    it('clears a previously-failed sync flag once an edit successfully updates the Outlook contact (Checkpoint J)', async () => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: 'c1',
        email: 'a@example.com',
        providerContactId: 'contact-1',
        contactProviderCode: MS_GRAPH_CONTACTS_PROVIDER_CODE,
        contactSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
      });
      prisma.candidate.upsert.mockResolvedValue({ id: 'c1', firstName: 'A2', lastName: 'B', email: 'a@example.com', phone: null });
      contactsRegistry.get.mockReturnValue({ updateContact: jest.fn().mockResolvedValue(undefined) });
      prisma.candidate.update.mockResolvedValue({ id: 'c1', contactSyncFailedAt: null });

      const result: any = await service.upsertCandidate({ firstName: 'A2', lastName: 'B', email: 'a@example.com' });

      expect(prisma.candidate.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { contactSyncFailedAt: null } });
      expect(result.contactSyncFailedAt).toBeNull();
    });

    it('marks the failure flag (without losing the row) when the Outlook contact update fails (Checkpoint J)', async () => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: 'c1',
        email: 'a@example.com',
        providerContactId: 'contact-1',
        contactProviderCode: MS_GRAPH_CONTACTS_PROVIDER_CODE,
        contactSyncFailedAt: null,
      });
      const upserted = { id: 'c1', firstName: 'A2', lastName: 'B', email: 'a@example.com', phone: null };
      prisma.candidate.upsert.mockResolvedValue(upserted);
      contactsRegistry.get.mockReturnValue({ updateContact: jest.fn().mockRejectedValue(new Error('Graph down')) });
      prisma.candidate.update.mockResolvedValue({ id: 'c1', contactSyncFailedAt: new Date() });

      const result: any = await service.upsertCandidate({ firstName: 'A2', lastName: 'B', email: 'a@example.com' });

      expect(prisma.candidate.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { contactSyncFailedAt: expect.any(Date) } });
      expect(result).toBe(upserted);
    });
  });

  describe('apply', () => {
    it('rejects applying to a vacancy that is not OPEN', async () => {
      prisma.vacancy.findUnique.mockResolvedValue({ id: 'v1', status: VacancyStatus.CLOSED });
      await expect(service.apply({ vacancyId: 'v1', candidateId: 'c1' })).rejects.toThrow(ConflictException);
    });

    it('rejects a duplicate application', async () => {
      prisma.vacancy.findUnique.mockResolvedValue({ id: 'v1', status: VacancyStatus.OPEN });
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1' });
      await expect(service.apply({ vacancyId: 'v1', candidateId: 'c1' })).rejects.toThrow(ConflictException);
    });

    it('creates an APPLIED application', async () => {
      prisma.vacancy.findUnique.mockResolvedValue({ id: 'v1', status: VacancyStatus.OPEN });
      prisma.jobApplication.findUnique.mockResolvedValue(null);
      prisma.jobApplication.create.mockImplementation(({ data }: any) => ({ id: 'app1', ...data }));
      const result: any = await service.apply({ vacancyId: 'v1', candidateId: 'c1' });
      expect(result.stage).toBe(ApplicationStage.APPLIED);
    });
  });

  describe('advanceStage', () => {
    it('rejects moving an application backward in the pipeline', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.SHORTLISTED,
        candidate: {},
        vacancy: {},
        interviews: [],
        offer: null,
      });
      await expect(service.advanceStage('app1', ApplicationStage.APPLIED)).rejects.toThrow(ConflictException);
    });

    it('rejects moving into HIRED directly (must use the hire endpoint)', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.OFFER,
        candidate: {},
        vacancy: {},
        interviews: [],
        offer: null,
      });
      await expect(service.advanceStage('app1', ApplicationStage.HIRED)).rejects.toThrow(ConflictException);
    });

    it('allows moving forward to the next stage', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.SCREENING,
        candidate: {},
        vacancy: {},
        interviews: [],
        offer: null,
      });
      prisma.jobApplication.update.mockImplementation(({ data }: any) => ({ id: 'app1', ...data }));
      const result: any = await service.advanceStage('app1', ApplicationStage.SHORTLISTED);
      expect(result.stage).toBe(ApplicationStage.SHORTLISTED);
    });
  });

  describe('setScore', () => {
    it('rejects a score outside 0-100', async () => {
      await expect(service.setScore('app1', 150)).rejects.toThrow(BadRequestException);
    });
  });

  describe('hire', () => {
    it('rejects hiring without an ACCEPTED offer', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.OFFER,
        offer: { status: 'SENT' },
        candidate: {},
        vacancy: {},
        interviews: [],
      });
      await expect(service.hire('app1', { entityId: 'e1', employeeCode: 'EMP1' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates an Employee and marks the application HIRED', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.OFFER,
        offer: { status: 'ACCEPTED', jobTitle: 'Engineer', gradeLevel: 'L3' },
        candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: null },
        vacancy: { departmentId: 'd1', employmentType: 'FULL_TIME' },
        interviews: [],
      });
      prisma.employee.create.mockImplementation(({ data }: any) => ({ id: 'emp1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});

      const employee: any = await service.hire('app1', { entityId: 'e1', employeeCode: 'EMP1' });
      expect(employee.id).toBe('emp1');
      expect(prisma.jobApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'app1' }, data: expect.objectContaining({ hiredEmployeeId: 'emp1' }) }),
      );
    });
    it('rejects hiring when a background check exists and is not CLEARED (ported from ZIP A)', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.OFFER,
        offer: { status: 'ACCEPTED', jobTitle: 'Engineer', gradeLevel: 'L3' },
        candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: null },
        vacancy: { departmentId: 'd1', employmentType: 'FULL_TIME' },
        interviews: [],
        backgroundCheck: { status: 'FLAGGED' },
      });
      await expect(service.hire('app1', { entityId: 'e1', employeeCode: 'EMP1' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });

    it('allows hiring when the background check is CLEARED', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.OFFER,
        offer: { status: 'ACCEPTED', jobTitle: 'Engineer', gradeLevel: 'L3' },
        candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: null },
        vacancy: { departmentId: 'd1', employmentType: 'FULL_TIME' },
        interviews: [],
        backgroundCheck: { status: 'CLEARED' },
      });
      prisma.employee.create.mockImplementation(({ data }: any) => ({ id: 'emp1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});

      const employee: any = await service.hire('app1', { entityId: 'e1', employeeCode: 'EMP1' });
      expect(employee.id).toBe('emp1');
    });

    it('does not attempt directory sync when no WorkspaceAdminProvider is registered', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.OFFER,
        offer: { status: 'ACCEPTED', jobTitle: 'Engineer', gradeLevel: 'L3' },
        candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: null },
        vacancy: { departmentId: 'd1', employmentType: 'FULL_TIME' },
        interviews: [],
      });
      prisma.employee.create.mockImplementation(({ data }: any) => ({ id: 'emp1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});

      const employee: any = await service.hire('app1', { entityId: 'e1', employeeCode: 'EMP1' });

      expect(employee.id).toBe('emp1');
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it('creates a Workspace directory account and records directoryProviderCode/directoryUserId on success', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.OFFER,
        offer: { status: 'ACCEPTED', jobTitle: 'Engineer', gradeLevel: 'L3' },
        candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: null },
        vacancy: { departmentId: 'd1', employmentType: 'FULL_TIME' },
        interviews: [],
      });
      prisma.employee.create.mockImplementation(({ data }: any) => ({ id: 'emp1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      workspaceAdminRegistry.isRegistered.mockReturnValue(true);
      const createUser = jest.fn().mockResolvedValue({ providerUserId: 'directory-id-1' });
      workspaceAdminRegistry.get.mockReturnValue({ createUser });
      prisma.employee.update.mockResolvedValue({ id: 'emp1', directoryProviderCode: GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE, directoryUserId: 'directory-id-1' });

      const employee: any = await service.hire('app1', { entityId: 'e1', employeeCode: 'EMP1' });

      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({ primaryEmail: 'ada@example.com', givenName: 'Ada', familyName: 'Lovelace' }),
      );
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp1' },
        data: { directoryProviderCode: GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE, directoryUserId: 'directory-id-1', directorySyncFailedAt: null },
      });
      expect(employee.directoryUserId).toBe('directory-id-1');
    });

    it('marks directorySyncFailedAt and still returns the employee when directory-account creation fails', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({
        id: 'app1',
        stage: ApplicationStage.OFFER,
        offer: { status: 'ACCEPTED', jobTitle: 'Engineer', gradeLevel: 'L3' },
        candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', phone: null },
        vacancy: { departmentId: 'd1', employmentType: 'FULL_TIME' },
        interviews: [],
      });
      prisma.employee.create.mockImplementation(({ data }: any) => ({ id: 'emp1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});
      workspaceAdminRegistry.isRegistered.mockReturnValue(true);
      workspaceAdminRegistry.get.mockReturnValue({ createUser: jest.fn().mockRejectedValue(new Error('Directory API rejected the request')) });
      prisma.employee.update.mockResolvedValue({ id: 'emp1', directorySyncFailedAt: new Date() });

      const employee: any = await service.hire('app1', { entityId: 'e1', employeeCode: 'EMP1' });

      expect(employee.id).toBe('emp1');
      expect(prisma.employee.update).toHaveBeenCalledWith({ where: { id: 'emp1' }, data: { directorySyncFailedAt: expect.any(Date) } });
    });
  });
  describe('findCandidate', () => {
    it('throws NotFoundException for an unknown candidate', async () => {
      prisma.candidate.findUnique.mockResolvedValue(null);
      await expect(service.findCandidate('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('retryContactSync', () => {
    it('throws BadRequestException when there is no failure flag to retry', async () => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: 'c1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: null,
        contactSyncFailedAt: null,
      });

      await expect(service.retryContactSync('c1')).rejects.toThrow(BadRequestException);
    });

    it('re-runs the create sync and clears the failure flag on success', async () => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: 'c1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: '+1000',
        contactSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
      });
      contactsRegistry.isRegistered.mockReturnValue(true);
      const createContact = jest.fn().mockResolvedValue({ providerContactId: 'contact-new' });
      contactsRegistry.get.mockReturnValue({ createContact });
      prisma.candidate.update.mockResolvedValue({ id: 'c1', providerContactId: 'contact-new', contactSyncFailedAt: null });

      const result: any = await service.retryContactSync('c1');

      expect(createContact).toHaveBeenCalledWith({
        displayName: 'Ada Lovelace',
        emailAddress: 'ada@example.com',
        phoneNumber: '+1000',
      });
      expect(prisma.candidate.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { contactProviderCode: MS_GRAPH_CONTACTS_PROVIDER_CODE, providerContactId: 'contact-new', contactSyncFailedAt: null },
      });
      expect(result.providerContactId).toBe('contact-new');
    });

    it('throws ConflictException when the retry itself fails', async () => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: 'c1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: null,
        contactSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
      });
      contactsRegistry.isRegistered.mockReturnValue(true);
      const createContact = jest.fn().mockRejectedValue(new Error('Graph unavailable'));
      contactsRegistry.get.mockReturnValue({ createContact });
      prisma.candidate.update.mockResolvedValue({ id: 'c1', contactSyncFailedAt: new Date() });

      await expect(service.retryContactSync('c1')).rejects.toThrow(ConflictException);
    });

    it('retries the update (not a second create) when a providerContactId already exists (Checkpoint J)', async () => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: 'c1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: null,
        providerContactId: 'contact-1',
        contactProviderCode: MS_GRAPH_CONTACTS_PROVIDER_CODE,
        contactSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
      });
      const updateContact = jest.fn().mockResolvedValue(undefined);
      contactsRegistry.get.mockReturnValue({ updateContact });
      prisma.candidate.update.mockResolvedValue({ id: 'c1', contactSyncFailedAt: null });

      const result: any = await service.retryContactSync('c1');

      expect(updateContact).toHaveBeenCalledWith({
        providerContactId: 'contact-1',
        displayName: 'Ada Lovelace',
        emailAddress: 'ada@example.com',
        phoneNumber: undefined,
      });
      expect(prisma.candidate.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { contactSyncFailedAt: null } });
      expect(result.contactSyncFailedAt).toBeNull();
    });

    it('throws ConflictException when the update retry itself fails (Checkpoint J)', async () => {
      prisma.candidate.findUnique.mockResolvedValue({
        id: 'c1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phone: null,
        providerContactId: 'contact-1',
        contactProviderCode: MS_GRAPH_CONTACTS_PROVIDER_CODE,
        contactSyncFailedAt: new Date('2026-07-29T00:00:00Z'),
      });
      contactsRegistry.get.mockReturnValue({ updateContact: jest.fn().mockRejectedValue(new Error('Graph unavailable')) });
      prisma.candidate.update.mockResolvedValue({ id: 'c1', contactSyncFailedAt: new Date() });

      await expect(service.retryContactSync('c1')).rejects.toThrow(ConflictException);
    });
  });

  describe('retryDirectorySync', () => {
    it('throws NotFoundException for an unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(service.retryDirectorySync('emp-missing')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when there is no failure flag to retry', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@example.com',
        directoryUserId: null,
        directorySyncFailedAt: null,
      });

      await expect(service.retryDirectorySync('emp1')).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException without attempting a create when a directoryUserId already exists', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@example.com',
        directoryUserId: 'directory-id-1',
        directorySyncFailedAt: new Date('2026-07-29T00:00:00Z'),
      });

      await expect(service.retryDirectorySync('emp1')).rejects.toThrow(ConflictException);
      expect(workspaceAdminRegistry.get).not.toHaveBeenCalled();
    });

    it('re-runs the create sync and clears the failure flag on success', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@example.com',
        directoryUserId: null,
        directorySyncFailedAt: new Date('2026-07-29T00:00:00Z'),
      });
      workspaceAdminRegistry.isRegistered.mockReturnValue(true);
      const createUser = jest.fn().mockResolvedValue({ providerUserId: 'directory-id-1' });
      workspaceAdminRegistry.get.mockReturnValue({ createUser });
      prisma.employee.update.mockResolvedValue({
        id: 'emp1',
        directoryProviderCode: GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE,
        directoryUserId: 'directory-id-1',
        directorySyncFailedAt: null,
      });

      const result: any = await service.retryDirectorySync('emp1');

      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining({ primaryEmail: 'ada@example.com', givenName: 'Ada', familyName: 'Lovelace' }),
      );
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp1' },
        data: { directoryProviderCode: GOOGLE_WORKSPACE_ADMIN_PROVIDER_CODE, directoryUserId: 'directory-id-1', directorySyncFailedAt: null },
      });
      expect(result.directoryUserId).toBe('directory-id-1');
    });

    it('throws ConflictException when the retry itself fails', async () => {
      prisma.employee.findUnique.mockResolvedValue({
        id: 'emp1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        workEmail: 'ada@example.com',
        directoryUserId: null,
        directorySyncFailedAt: new Date('2026-07-29T00:00:00Z'),
      });
      workspaceAdminRegistry.isRegistered.mockReturnValue(true);
      workspaceAdminRegistry.get.mockReturnValue({ createUser: jest.fn().mockRejectedValue(new Error('Directory API unavailable')) });
      prisma.employee.update.mockResolvedValue({ id: 'emp1', directorySyncFailedAt: new Date() });

      await expect(service.retryDirectorySync('emp1')).rejects.toThrow(ConflictException);
    });
  });
  describe('findWithFailedContactSync', () => {
    it('filters to candidates with a failure flag, scoped to entityId when given', async () => {
      prisma.candidate.findMany.mockResolvedValue([{ id: 'c1', contactSyncFailedAt: new Date() }]);

      const result = await service.findWithFailedContactSync('ent-1');

      expect(prisma.candidate.findMany).toHaveBeenCalledWith({
        where: { contactSyncFailedAt: { not: null }, applications: { some: { vacancy: { entityId: 'ent-1' } } } },
        select: { id: true, firstName: true, lastName: true, email: true, contactSyncFailedAt: true },
        orderBy: { contactSyncFailedAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });

    it('omits the applications filter for the cross-entity total when no entityId is given', async () => {
      prisma.candidate.findMany.mockResolvedValue([]);

      await service.findWithFailedContactSync();

      expect(prisma.candidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contactSyncFailedAt: { not: null }, applications: undefined } }),
      );
    });
  });
});
