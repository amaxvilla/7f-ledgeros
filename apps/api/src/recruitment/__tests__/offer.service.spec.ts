import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { OfferStatus } from '@prisma/client';
import { OfferService } from '../offer.service';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngineService } from '../../workflow/workflow.service';
import { SignatureProviderRegistry } from '../../signatures/signature-provider.registry';
import { DOCUSIGN_PROVIDER_CODE } from '../../signatures/providers/docusign.provider';
import { ADOBE_SIGN_PROVIDER_CODE } from '../../signatures/providers/adobe-sign.provider';

function buildPrismaMock() {
  return {
    jobApplication: { findUnique: jest.fn(), update: jest.fn() },
    offer: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  };
}

function buildWorkflowMock() {
  return { startInstance: jest.fn(), getInstance: jest.fn() };
}

function buildSignatureProvidersMock() {
  return { isRegistered: jest.fn().mockReturnValue(false), get: jest.fn() };
}

describe('OfferService', () => {
  let service: OfferService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let workflow: ReturnType<typeof buildWorkflowMock>;
  let signatureProviders: ReturnType<typeof buildSignatureProvidersMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    workflow = buildWorkflowMock();
    signatureProviders = buildSignatureProvidersMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OfferService,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkflowEngineService, useValue: workflow },
        { provide: SignatureProviderRegistry, useValue: signatureProviders },
      ],
    }).compile();
    service = moduleRef.get(OfferService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rejects a non-positive salary', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', offer: null, vacancy: {} });
      await expect(
        service.create({ jobApplicationId: 'app1', jobTitle: 'Engineer', proposedSalary: 0 }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creating a second offer for the same application', async () => {
      prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', offer: { id: 'off1' }, vacancy: {} });
      await expect(
        service.create({ jobApplicationId: 'app1', jobTitle: 'Engineer', proposedSalary: 500000 }, 'u1'),
      ).rejects.toThrow(ConflictException);
    });

    describe('signatureProviderCode (Digital Signature Providers, Checkpoint M)', () => {
      it('defaults to DOCUSIGN_PROVIDER_CODE when the caller does not specify a provider', async () => {
        prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', offer: null, vacancy: {} });
        prisma.offer.create.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));

        await service.create({ jobApplicationId: 'app1', jobTitle: 'Engineer', proposedSalary: 500000 }, 'u1');

        expect(prisma.offer.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ signatureProviderCode: DOCUSIGN_PROVIDER_CODE }) }),
        );
      });

      it('persists the caller-chosen provider when specified', async () => {
        prisma.jobApplication.findUnique.mockResolvedValue({ id: 'app1', offer: null, vacancy: {} });
        prisma.offer.create.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));

        await service.create(
          { jobApplicationId: 'app1', jobTitle: 'Engineer', proposedSalary: 500000, signatureProviderCode: ADOBE_SIGN_PROVIDER_CODE },
          'u1',
        );

        expect(prisma.offer.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ signatureProviderCode: ADOBE_SIGN_PROVIDER_CODE }) }),
        );
      });
    });
  });

  describe('submitForApproval', () => {
    it('rejects submitting a non-DRAFT offer', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 'off1',
        status: OfferStatus.APPROVED,
        jobApplication: { candidate: {}, vacancy: {} },
      });
      await expect(service.submitForApproval('off1', 'u1')).rejects.toThrow(ConflictException);
    });
  });

  describe('send', () => {
    it('rejects sending an offer that is not APPROVED', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 'off1',
        status: OfferStatus.DRAFT,
        jobApplication: { candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }, vacancy: {} },
      });
      await expect(service.send('off1')).rejects.toThrow(ConflictException);
    });

    it('marks an APPROVED offer SENT and returns letter text (no signature provider registered)', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 'off1',
        status: OfferStatus.APPROVED,
        jobTitle: 'Engineer',
        gradeLevel: null,
        proposedSalary: 500000,
        currency: 'NGN',
        startDate: null,
        jobApplicationId: 'app1',
        jobApplication: { candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }, vacancy: {} },
      });
      prisma.offer.update.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));
      prisma.jobApplication.update.mockResolvedValue({});

      const result: any = await service.send('off1');
      expect(result.status).toBe(OfferStatus.SENT);
      expect(result.letterText).toContain('Ada Lovelace');
      expect(signatureProviders.get).not.toHaveBeenCalled();
    });

    describe('e-signature sync (Digital Signature Providers, Checkpoint C)', () => {
      function baseOffer() {
        return {
          id: 'off1',
          status: OfferStatus.APPROVED,
          jobTitle: 'Engineer',
          gradeLevel: null,
          proposedSalary: 500000,
          currency: 'NGN',
          startDate: null,
          jobApplicationId: 'app1',
          jobApplication: { candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }, vacancy: {} },
        };
      }

      it('sends the letter for signature and persists signatureProviderCode/EnvelopeId on success', async () => {
        prisma.offer.findUnique.mockResolvedValue(baseOffer());
        prisma.offer.update.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));
        prisma.jobApplication.update.mockResolvedValue({});
        signatureProviders.isRegistered.mockReturnValue(true);
        const sendForSignature = jest.fn().mockResolvedValue({ providerEnvelopeId: 'env-abc' });
        signatureProviders.get.mockReturnValue({ sendForSignature });

        const result: any = await service.send('off1');

        expect(sendForSignature).toHaveBeenCalledWith({
          documentName: 'offer-letter-off1.txt',
          documentBuffer: expect.any(Buffer),
          documentContentType: 'text/plain',
          signers: [{ email: 'ada@example.com', name: 'Ada Lovelace' }],
          subject: 'Your offer letter — please sign',
        });
        expect(result.signatureProviderCode).toBe(DOCUSIGN_PROVIDER_CODE);
        expect(result.signatureProviderEnvelopeId).toBe('env-abc');
        expect(result.signatureSyncFailedAt).toBeNull();
      });

      it('still returns the SENT offer (with letterText) when the signature provider throws', async () => {
        prisma.offer.findUnique.mockResolvedValue(baseOffer());
        prisma.offer.update.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));
        prisma.jobApplication.update.mockResolvedValue({});
        signatureProviders.isRegistered.mockReturnValue(true);
        signatureProviders.get.mockReturnValue({ sendForSignature: jest.fn().mockRejectedValue(new Error('DocuSign unreachable')) });

        const result: any = await service.send('off1');

        expect(result.status).toBe(OfferStatus.SENT);
        expect(result.letterText).toContain('Ada Lovelace');
        // tryMarkSignatureSyncFailed's own update call — the offer.update mock
        // implementation above echoes back whatever `data` it was called with.
        expect(prisma.offer.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'off1' }, data: { signatureSyncFailedAt: expect.any(Date) } }),
        );
      });

      it('does not attempt to send when no signature provider is registered', async () => {
        prisma.offer.findUnique.mockResolvedValue(baseOffer());
        prisma.offer.update.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));
        prisma.jobApplication.update.mockResolvedValue({});
        signatureProviders.isRegistered.mockReturnValue(false);

        await service.send('off1');

        expect(signatureProviders.get).not.toHaveBeenCalled();
      });
    });

    describe('provider-selectable e-signature sync (Digital Signature Providers, Checkpoint M)', () => {
      it('sends via the provider stored on the offer (from create()), not a hardcoded DOCUSIGN_PROVIDER_CODE', async () => {
        prisma.offer.findUnique.mockResolvedValue({
          id: 'off1',
          status: OfferStatus.APPROVED,
          jobTitle: 'Engineer',
          gradeLevel: null,
          proposedSalary: 500000,
          currency: 'NGN',
          startDate: null,
          jobApplicationId: 'app1',
          signatureProviderCode: ADOBE_SIGN_PROVIDER_CODE,
          jobApplication: { candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }, vacancy: {} },
        });
        prisma.offer.update.mockImplementation(({ data }: any) => ({ id: 'off1', signatureProviderCode: ADOBE_SIGN_PROVIDER_CODE, ...data }));
        prisma.jobApplication.update.mockResolvedValue({});
        signatureProviders.isRegistered.mockReturnValue(true);
        const sendForSignature = jest.fn().mockResolvedValue({ providerEnvelopeId: 'env-adobe' });
        signatureProviders.get.mockReturnValue({ sendForSignature });

        const result: any = await service.send('off1');

        expect(signatureProviders.isRegistered).toHaveBeenCalledWith(ADOBE_SIGN_PROVIDER_CODE);
        expect(signatureProviders.get).toHaveBeenCalledWith(ADOBE_SIGN_PROVIDER_CODE);
        expect(result.signatureProviderCode).toBe(ADOBE_SIGN_PROVIDER_CODE);
        expect(result.signatureProviderEnvelopeId).toBe('env-adobe');
      });
    });
  });

  describe('findWithFailedSignatureSync', () => {
    it('queries offers with a non-null signatureSyncFailedAt, most recent first', async () => {
      prisma.offer.findMany.mockResolvedValue([{ id: 'off1', signatureSyncFailedAt: new Date() }]);

      const result = await service.findWithFailedSignatureSync();

      expect(prisma.offer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { signatureSyncFailedAt: { not: null } }, orderBy: { signatureSyncFailedAt: 'desc' } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('retrySignatureSync', () => {
    function failedOffer(_overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'off1',
        jobTitle: 'Engineer',
        gradeLevel: null,
        proposedSalary: 500000,
        currency: 'NGN',
        startDate: null,
        jobApplicationId: 'app1',
        signatureSyncFailedAt: new Date(),
        signatureProviderEnvelopeId: null,
        jobApplication: { candidate: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' }, vacancy: {} },
      };
    }

    it('rejects retrying an offer with no failed signature sync', async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...failedOffer(), signatureSyncFailedAt: null });
      await expect(service.retrySignatureSync('off1')).rejects.toThrow(BadRequestException);
    });

    it('rejects retrying when a signature envelope already exists (no update/void retry path yet)', async () => {
      prisma.offer.findUnique.mockResolvedValue({ ...failedOffer(), signatureProviderEnvelopeId: 'env-existing' });
      await expect(service.retrySignatureSync('off1')).rejects.toThrow(ConflictException);
    });

    it('re-sends for signature and clears the failure flag on success', async () => {
      prisma.offer.findUnique.mockResolvedValue(failedOffer());
      prisma.offer.update.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));
      signatureProviders.isRegistered.mockReturnValue(true);
      const sendForSignature = jest.fn().mockResolvedValue({ providerEnvelopeId: 'env-retry' });
      signatureProviders.get.mockReturnValue({ sendForSignature });

      const result: any = await service.retrySignatureSync('off1');

      expect(sendForSignature).toHaveBeenCalledWith({
        documentName: 'offer-letter-off1.txt',
        documentBuffer: expect.any(Buffer),
        documentContentType: 'text/plain',
        signers: [{ email: 'ada@example.com', name: 'Ada Lovelace' }],
        subject: 'Your offer letter — please sign',
      });
      expect(result.signatureProviderEnvelopeId).toBe('env-retry');
      expect(result.signatureSyncFailedAt).toBeNull();
      expect(result.letterText).toContain('Ada Lovelace');
    });

    it('throws a ConflictException when the retry itself fails', async () => {
      prisma.offer.findUnique.mockResolvedValue(failedOffer());
      prisma.offer.update.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));
      signatureProviders.isRegistered.mockReturnValue(true);
      signatureProviders.get.mockReturnValue({ sendForSignature: jest.fn().mockRejectedValue(new Error('DocuSign unreachable')) });

      await expect(service.retrySignatureSync('off1')).rejects.toThrow(ConflictException);
    });
  });

  describe('respond', () => {
    it('rejects responding to an offer that has not been SENT', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 'off1',
        status: OfferStatus.DRAFT,
        jobApplication: { candidate: {}, vacancy: {} },
      });
      await expect(service.respond('off1', true)).rejects.toThrow(ConflictException);
    });

    it('accepts a SENT offer', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 'off1',
        status: OfferStatus.SENT,
        jobApplication: { candidate: {}, vacancy: {} },
      });
      prisma.offer.update.mockImplementation(({ data }: any) => ({ id: 'off1', ...data }));
      const result: any = await service.respond('off1', true);
      expect(result.status).toBe(OfferStatus.ACCEPTED);
    });
  });

  describe('withdraw', () => {
    it('withdraws an offer with no signature envelope, without touching the signature provider', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 'off1',
        signatureProviderEnvelopeId: null,
        signatureProviderCode: null,
        jobApplication: { candidate: {}, vacancy: {} },
      });
      prisma.offer.update.mockResolvedValue({ id: 'off1', status: OfferStatus.WITHDRAWN });

      const result: any = await service.withdraw('off1');

      expect(signatureProviders.get).not.toHaveBeenCalled();
      expect(result.status).toBe(OfferStatus.WITHDRAWN);
    });

    it('voids the outstanding signature envelope on withdrawal (Checkpoint G)', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 'off1',
        signatureProviderEnvelopeId: 'env-1',
        signatureProviderCode: DOCUSIGN_PROVIDER_CODE,
        jobApplication: { candidate: {}, vacancy: {} },
      });
      prisma.offer.update.mockResolvedValue({ id: 'off1', status: OfferStatus.WITHDRAWN });
      const voidEnvelope = jest.fn().mockResolvedValue(undefined);
      signatureProviders.get.mockReturnValue({ voidEnvelope });

      const result: any = await service.withdraw('off1');

      expect(signatureProviders.get).toHaveBeenCalledWith(DOCUSIGN_PROVIDER_CODE);
      expect(voidEnvelope).toHaveBeenCalledWith({ providerEnvelopeId: 'env-1', reason: 'Offer withdrawn' });
      expect(result.status).toBe(OfferStatus.WITHDRAWN);
    });

    it('still withdraws the offer even when voiding the envelope fails', async () => {
      prisma.offer.findUnique.mockResolvedValue({
        id: 'off1',
        signatureProviderEnvelopeId: 'env-1',
        signatureProviderCode: DOCUSIGN_PROVIDER_CODE,
        jobApplication: { candidate: {}, vacancy: {} },
      });
      prisma.offer.update.mockResolvedValue({ id: 'off1', status: OfferStatus.WITHDRAWN });
      signatureProviders.get.mockReturnValue({ voidEnvelope: jest.fn().mockRejectedValue(new Error('DocuSign unreachable')) });

      const result: any = await service.withdraw('off1');

      expect(result.status).toBe(OfferStatus.WITHDRAWN);
    });
  });

  describe('checkSignatureStatus', () => {
    function outstandingOffer(overrides: Record<string, unknown> = {}) {
      return {
        id: 'off1',
        status: OfferStatus.SENT,
        signatureProviderEnvelopeId: 'env-1',
        signatureProviderCode: DOCUSIGN_PROVIDER_CODE,
        jobApplication: { candidate: {}, vacancy: {} },
        ...overrides,
      };
    }

    it('throws ConflictException when the offer has no outstanding envelope', async () => {
      prisma.offer.findUnique.mockResolvedValue(outstandingOffer({ signatureProviderEnvelopeId: null, signatureProviderCode: null }));
      await expect(service.checkSignatureStatus('off1')).rejects.toThrow(ConflictException);
      expect(signatureProviders.get).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the offer is not SENT', async () => {
      prisma.offer.findUnique.mockResolvedValue(outstandingOffer({ status: OfferStatus.ACCEPTED }));
      await expect(service.checkSignatureStatus('off1')).rejects.toThrow(ConflictException);
      expect(signatureProviders.get).not.toHaveBeenCalled();
    });

    it('calls getStatus with the stored envelope id via the stored provider code', async () => {
      prisma.offer.findUnique.mockResolvedValue(outstandingOffer());
      const getStatus = jest.fn().mockResolvedValue({ providerEnvelopeId: 'env-1', status: 'SENT' });
      signatureProviders.get.mockReturnValue({ getStatus });

      await service.checkSignatureStatus('off1');

      expect(signatureProviders.get).toHaveBeenCalledWith(DOCUSIGN_PROVIDER_CODE);
      expect(getStatus).toHaveBeenCalledWith('env-1');
    });

    it('returns the offer unchanged (no Prisma update) when the provider still reports SENT', async () => {
      prisma.offer.findUnique.mockResolvedValue(outstandingOffer());
      signatureProviders.get.mockReturnValue({ getStatus: jest.fn().mockResolvedValue({ providerEnvelopeId: 'env-1', status: 'SENT' }) });

      const result: any = await service.checkSignatureStatus('off1');

      expect(prisma.offer.update).not.toHaveBeenCalled();
      expect(result.status).toBe(OfferStatus.SENT);
      expect(result.providerStatus).toBe('SENT');
    });

    it('transitions the offer to ACCEPTED (via respond) when the provider reports COMPLETED', async () => {
      prisma.offer.findUnique.mockResolvedValue(outstandingOffer());
      signatureProviders.get.mockReturnValue({ getStatus: jest.fn().mockResolvedValue({ providerEnvelopeId: 'env-1', status: 'COMPLETED' }) });
      prisma.offer.update.mockResolvedValue({ id: 'off1', status: OfferStatus.ACCEPTED, respondedAt: new Date() });

      const result: any = await service.checkSignatureStatus('off1');

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'off1' },
        data: { status: OfferStatus.ACCEPTED, respondedAt: expect.any(Date), declineReason: undefined },
      });
      expect(result.status).toBe(OfferStatus.ACCEPTED);
      expect(result.providerStatus).toBe('COMPLETED');
    });

    it('transitions the offer to DECLINED (via respond) with a fixed reason when the provider reports DECLINED', async () => {
      prisma.offer.findUnique.mockResolvedValue(outstandingOffer());
      signatureProviders.get.mockReturnValue({ getStatus: jest.fn().mockResolvedValue({ providerEnvelopeId: 'env-1', status: 'DECLINED' }) });
      prisma.offer.update.mockResolvedValue({ id: 'off1', status: OfferStatus.DECLINED, respondedAt: new Date() });

      const result: any = await service.checkSignatureStatus('off1');

      expect(prisma.offer.update).toHaveBeenCalledWith({
        where: { id: 'off1' },
        data: { status: OfferStatus.DECLINED, respondedAt: expect.any(Date), declineReason: 'Declined via signature provider' },
      });
      expect(result.status).toBe(OfferStatus.DECLINED);
      expect(result.providerStatus).toBe('DECLINED');
    });

    it('leaves the offer unchanged for a VOIDED/EXPIRED provider status (unhandled edge case, deliberately not mapped)', async () => {
      prisma.offer.findUnique.mockResolvedValue(outstandingOffer());
      signatureProviders.get.mockReturnValue({ getStatus: jest.fn().mockResolvedValue({ providerEnvelopeId: 'env-1', status: 'VOIDED' }) });

      const result: any = await service.checkSignatureStatus('off1');

      expect(prisma.offer.update).not.toHaveBeenCalled();
      expect(result.status).toBe(OfferStatus.SENT);
      expect(result.providerStatus).toBe('VOIDED');
    });
  });
});
