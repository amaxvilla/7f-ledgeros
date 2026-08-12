import { SignaturesController } from '../signatures.controller';

describe('SignaturesController', () => {
  let manual: { findAll: jest.Mock; findEnvelope: jest.Mock; recordCompletion: jest.Mock; recordDecline: jest.Mock };
  let controller: SignaturesController;

  beforeEach(() => {
    manual = { findAll: jest.fn(), findEnvelope: jest.fn(), recordCompletion: jest.fn(), recordDecline: jest.fn() };
    controller = new SignaturesController(manual as any);
  });

  it('delegates findAll to ManualSignatureService.findAll with no status filter', async () => {
    manual.findAll.mockResolvedValue([{ id: 'env-1', status: 'SENT' }]);

    const result = await controller.findAll({} as any);

    expect(manual.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([{ id: 'env-1', status: 'SENT' }]);
  });

  it('delegates findAll to ManualSignatureService.findAll with a status filter', async () => {
    manual.findAll.mockResolvedValue([{ id: 'env-2', status: 'DECLINED' }]);

    await controller.findAll({ status: 'DECLINED' } as any);

    expect(manual.findAll).toHaveBeenCalledWith('DECLINED');
  });

  it('delegates findOne to ManualSignatureService.findEnvelope', async () => {
    manual.findEnvelope.mockResolvedValue({ id: 'env-1', status: 'SENT' });
    const result = await controller.findOne('env-1');
    expect(manual.findEnvelope).toHaveBeenCalledWith('env-1');
    expect(result).toEqual({ id: 'env-1', status: 'SENT' });
  });

  it('delegates complete to ManualSignatureService.recordCompletion', async () => {
    const file = { buffer: Buffer.from('x'), originalname: 'signed.pdf', mimetype: 'application/pdf' } as any;
    manual.recordCompletion.mockResolvedValue({ id: 'env-1', status: 'COMPLETED' });

    const result = await controller.complete('env-1', file);

    expect(manual.recordCompletion).toHaveBeenCalledWith('env-1', file);
    expect(result).toEqual({ id: 'env-1', status: 'COMPLETED' });
  });

  it('delegates decline to ManualSignatureService.recordDecline (Checkpoint J)', async () => {
    manual.recordDecline.mockResolvedValue({ id: 'env-1', status: 'DECLINED' });

    const result = await controller.decline('env-1', 'no thanks');

    expect(manual.recordDecline).toHaveBeenCalledWith('env-1', 'no thanks');
    expect(result).toEqual({ id: 'env-1', status: 'DECLINED' });
  });
});
