import { SignatureService } from '../signature.service';

describe('SignatureService', () => {
  let registry: { get: jest.Mock };
  let provider: {
    sendForSignature: jest.Mock;
    getStatus: jest.Mock;
    downloadSignedDocument: jest.Mock;
    voidEnvelope: jest.Mock;
  };
  let service: SignatureService;

  beforeEach(() => {
    provider = {
      sendForSignature: jest.fn().mockResolvedValue({ providerEnvelopeId: 'env1' }),
      getStatus: jest.fn().mockResolvedValue({ status: 'SENT' }),
      downloadSignedDocument: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
      voidEnvelope: jest.fn().mockResolvedValue(undefined),
    };
    registry = { get: jest.fn().mockReturnValue(provider) };
    service = new SignatureService(registry as any);
  });

  describe('sendForSignature', () => {
    it('resolves the provider by providerCode and forwards the params', async () => {
      const signers = [{ email: 'a@example.com', name: 'A' }];
      const documentBuffer = Buffer.from('doc-bytes');

      const result = await service.sendForSignature('DOCUSIGN', {
        documentName: 'Offer Letter',
        documentBuffer,
        documentContentType: 'application/pdf',
        signers,
        subject: 'Please sign',
        message: 'See attached',
      });

      expect(registry.get).toHaveBeenCalledWith('DOCUSIGN');
      expect(provider.sendForSignature).toHaveBeenCalledWith({
        documentName: 'Offer Letter',
        documentBuffer,
        documentContentType: 'application/pdf',
        signers,
        subject: 'Please sign',
        message: 'See attached',
      });
      expect(result).toEqual({ providerEnvelopeId: 'env1' });
    });
  });

  describe('getStatus', () => {
    it('resolves the provider and forwards providerEnvelopeId', async () => {
      const result = await service.getStatus('env1', 'DOCUSIGN');
      expect(registry.get).toHaveBeenCalledWith('DOCUSIGN');
      expect(provider.getStatus).toHaveBeenCalledWith('env1');
      expect(result).toEqual({ status: 'SENT' });
    });
  });

  describe('downloadSignedDocument', () => {
    it('resolves the provider and returns the raw buffer', async () => {
      const result = await service.downloadSignedDocument('env1', 'ADOBE_SIGN');
      expect(registry.get).toHaveBeenCalledWith('ADOBE_SIGN');
      expect(provider.downloadSignedDocument).toHaveBeenCalledWith('env1');
      expect(result).toEqual(Buffer.from('pdf-bytes'));
    });
  });

  describe('voidEnvelope', () => {
    it('passes providerEnvelopeId and reason through', async () => {
      await service.voidEnvelope('env1', 'DOCUSIGN', 'sent in error');
      expect(registry.get).toHaveBeenCalledWith('DOCUSIGN');
      expect(provider.voidEnvelope).toHaveBeenCalledWith({ providerEnvelopeId: 'env1', reason: 'sent in error' });
    });

    it('works with no reason given', async () => {
      await service.voidEnvelope('env1', 'DOCUSIGN');
      expect(provider.voidEnvelope).toHaveBeenCalledWith({ providerEnvelopeId: 'env1', reason: undefined });
    });
  });

  it('propagates the registry error for an unregistered providerCode rather than swallowing it', async () => {
    registry.get.mockImplementation(() => {
      throw new Error('No signature provider registered for providerCode "HELLOSIGN"');
    });

    await expect(service.getStatus('env1', 'HELLOSIGN')).rejects.toThrow('No signature provider registered for providerCode "HELLOSIGN"');
  });
});
