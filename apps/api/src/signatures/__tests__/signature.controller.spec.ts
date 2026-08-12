import { SignatureController } from '../signature.controller';

describe('SignatureController', () => {
  let signatures: { sendForSignature: jest.Mock; getStatus: jest.Mock; downloadSignedDocument: jest.Mock; voidEnvelope: jest.Mock };
  let controller: SignatureController;

  beforeEach(() => {
    signatures = {
      sendForSignature: jest.fn().mockResolvedValue({ providerEnvelopeId: 'env1' }),
      getStatus: jest.fn().mockResolvedValue({ status: 'SENT' }),
      downloadSignedDocument: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
      voidEnvelope: jest.fn().mockResolvedValue(undefined),
    };
    controller = new SignatureController(signatures as any);
  });

  it('sendForSignature() parses the signers JSON field and delegates to SignatureService', async () => {
    const file = { buffer: Buffer.from('doc-bytes'), originalname: 'offer.pdf', mimetype: 'application/pdf' } as any;
    const signersJson = JSON.stringify([{ email: 'a@example.com', name: 'A' }]);

    const result = await controller.sendForSignature(file, 'DOCUSIGN', 'Offer Letter', signersJson, 'Please sign', 'See attached');

    expect(signatures.sendForSignature).toHaveBeenCalledWith('DOCUSIGN', {
      documentName: 'Offer Letter',
      documentBuffer: file.buffer,
      documentContentType: 'application/pdf',
      signers: [{ email: 'a@example.com', name: 'A' }],
      subject: 'Please sign',
      message: 'See attached',
    });
    expect(result).toEqual({ providerEnvelopeId: 'env1' });
  });

  it('getStatus() delegates to SignatureService.getStatus', async () => {
    const result = await controller.getStatus('env1', { providerCode: 'DOCUSIGN' } as any);
    expect(signatures.getStatus).toHaveBeenCalledWith('env1', 'DOCUSIGN');
    expect(result).toEqual({ status: 'SENT' });
  });

  it('downloadSignedDocument() sets octet-stream headers and sends the raw buffer', async () => {
    const res = { set: jest.fn(), send: jest.fn() } as any;

    await controller.downloadSignedDocument('env1', { providerCode: 'ADOBE_SIGN' } as any, res);

    expect(signatures.downloadSignedDocument).toHaveBeenCalledWith('env1', 'ADOBE_SIGN');
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'application/octet-stream', 'Content-Disposition': expect.stringContaining('env1') }),
    );
    expect(res.send).toHaveBeenCalledWith(Buffer.from('pdf-bytes'));
  });

  it('voidEnvelope() delegates to SignatureService.voidEnvelope with the path param and DTO fields', async () => {
    const dto = { providerCode: 'DOCUSIGN', reason: 'sent in error' } as any;
    await controller.voidEnvelope('env1', dto);
    expect(signatures.voidEnvelope).toHaveBeenCalledWith('env1', 'DOCUSIGN', 'sent in error');
  });
});
