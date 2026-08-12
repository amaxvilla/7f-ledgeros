import { SmtpHealthCheckDriver } from '../smtp-health-check.driver';

const verifyMock = jest.fn();
const closeMock = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn().mockImplementation(() => ({ verify: verifyMock, close: closeMock })),
  },
}));

describe('SmtpHealthCheckDriver', () => {
  let driver: SmtpHealthCheckDriver;

  beforeEach(() => {
    verifyMock.mockReset();
    closeMock.mockReset();
    driver = new SmtpHealthCheckDriver();
  });

  it('reports failure when config.host is missing', async () => {
    const result = await driver.healthCheck({ config: {}, credentials: { user: 'u', password: 'p' } });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('config.host');
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('reports ok when verify() succeeds', async () => {
    verifyMock.mockResolvedValue(true);
    const result = await driver.healthCheck({
      config: { host: 'smtp.example.com', port: 587, secure: false },
      credentials: { user: 'apikey', password: 'secret' },
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain('smtp.example.com:587');
    expect(closeMock).toHaveBeenCalled();
  });

  it('reports failure when verify() rejects', async () => {
    verifyMock.mockRejectedValue(new Error('Invalid login'));
    const result = await driver.healthCheck({
      config: { host: 'smtp.example.com' },
      credentials: { user: 'apikey', password: 'wrong' },
    });
    expect(result.ok).toBe(false);
    expect(result.message).toBe('Invalid login');
    expect(closeMock).toHaveBeenCalled();
  });

  it('works with no auth (open relay) when credentials are absent', async () => {
    verifyMock.mockResolvedValue(true);
    const result = await driver.healthCheck({ config: { host: 'localhost', port: 25 }, credentials: null });
    expect(result.ok).toBe(true);
  });
});
