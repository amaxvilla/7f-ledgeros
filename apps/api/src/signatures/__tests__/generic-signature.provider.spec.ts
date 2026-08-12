import { GenericSignatureProvider, GENERIC_SIGNATURE_PROVIDER_CODE } from '../providers/generic-signature.provider';
import { SignatureProviderRegistry } from '../signature-provider.registry';

const fetchMock = jest.fn();

function buildPrismaMock() {
  return {
    manualSignatureEnvelope: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  };
}

function buildStorageMock() {
  return {
    upload: jest.fn(),
    getUrl: jest.fn(),
    delete: jest.fn(),
  };
}

describe('GenericSignatureProvider', () => {
  let provider: GenericSignatureProvider;
  let registry: SignatureProviderRegistry;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let storage: ReturnType<typeof buildStorageMock>;

  beforeEach(() => {
    fetchMock.mockReset();
    (global as any).fetch = fetchMock;
    prisma = buildPrismaMock();
    storage = buildStorageMock();
    registry = new SignatureProviderRegistry();
    provider = new GenericSignatureProvider(prisma as any, storage as any, registry);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('onModuleInit', () => {
    it('registers itself into SignatureProviderRegistry under "GENERIC_SIGNATURE"', () => {
      expect(registry.isRegistered(GENERIC_SIGNATURE_PROVIDER_CODE)).toBe(false);
      provider.onModuleInit();
      expect(registry.isRegistered(GENERIC_SIGNATURE_PROVIDER_CODE)).toBe(true);
      expect(registry.get(GENERIC_SIGNATURE_PROVIDER_CODE)).toBe(provider);
    });
  });

  describe('sendForSignature', () => {
    it('creates a row, uploads the document under an id-namespaced key, and returns the row id as the envelope id', async () => {
      prisma.manualSignatureEnvelope.create.mockResolvedValue({ id: 'env-1' });
      storage.upload.mockResolvedValue({ key: 'signatures/manual/env-1/offer.txt', url: 'https://cdn.example/offer.txt' });
      prisma.manualSignatureEnvelope.update.mockResolvedValue({});

      const result = await provider.sendForSignature({
        documentName: 'offer.txt',
        documentBuffer: Buffer.from('hello'),
        documentContentType: 'text/plain',
        signers: [{ email: 'ada@example.com', name: 'Ada Lovelace' }],
        subject: 'Please sign',
      });

      expect(prisma.manualSignatureEnvelope.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentName: 'offer.txt',
          documentContentType: 'text/plain',
          subject: 'Please sign',
          status: 'SENT',
        }),
      });
      expect(storage.upload).toHaveBeenCalledWith({
        key: 'signatures/manual/env-1/offer.txt',
        buffer: expect.any(Buffer),
        contentType: 'text/plain',
      });
      expect(prisma.manualSignatureEnvelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { documentKey: 'signatures/manual/env-1/offer.txt' },
      });
      expect(result).toEqual({ providerEnvelopeId: 'env-1' });
    });
  });

  describe('getStatus', () => {
    it('returns the row status as-is', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', status: 'DELIVERED' });
      const result = await provider.getStatus('env-1');
      expect(result).toEqual({ status: 'DELIVERED' });
    });

    it('throws when the envelope does not exist', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue(null);
      await expect(provider.getStatus('missing')).rejects.toThrow('No manual signature envelope found');
    });
  });

  describe('downloadSignedDocument', () => {
    it('throws when no signed copy has been recorded yet', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', signedDocumentKey: null });
      await expect(provider.downloadSignedDocument('env-1')).rejects.toThrow('has no signed document recorded yet');
    });

    it('fetches the signed copy from storage once one is recorded', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', signedDocumentKey: 'signatures/manual/env-1/signed.pdf' });
      storage.getUrl.mockResolvedValue('https://cdn.example/signed.pdf');
      fetchMock.mockResolvedValue({ ok: true, arrayBuffer: async () => Buffer.from('signed-bytes') });

      const result = await provider.downloadSignedDocument('env-1');

      expect(storage.getUrl).toHaveBeenCalledWith('signatures/manual/env-1/signed.pdf');
      expect(result).toEqual(Buffer.from('signed-bytes'));
    });

    it('throws when the storage fetch itself fails', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1', signedDocumentKey: 'signatures/manual/env-1/signed.pdf' });
      storage.getUrl.mockResolvedValue('https://cdn.example/signed.pdf');
      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      await expect(provider.downloadSignedDocument('env-1')).rejects.toThrow('HTTP 404');
    });
  });

  describe('voidEnvelope', () => {
    it('marks the row VOIDED with the given reason', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue({ id: 'env-1' });
      prisma.manualSignatureEnvelope.update.mockResolvedValue({});

      await provider.voidEnvelope({ providerEnvelopeId: 'env-1', reason: 'Offer withdrawn' });

      expect(prisma.manualSignatureEnvelope.update).toHaveBeenCalledWith({
        where: { id: 'env-1' },
        data: { status: 'VOIDED', voidReason: 'Offer withdrawn' },
      });
    });

    it('throws when the envelope does not exist', async () => {
      prisma.manualSignatureEnvelope.findUnique.mockResolvedValue(null);
      await expect(provider.voidEnvelope({ providerEnvelopeId: 'missing' })).rejects.toThrow('No manual signature envelope found');
    });
  });
});
