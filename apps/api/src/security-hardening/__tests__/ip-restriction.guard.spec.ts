import { ForbiddenException } from '@nestjs/common';
import { IpRestrictionGuard } from '../ip-restriction.guard';

function buildContext(request: any) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as any;
}

describe('IpRestrictionGuard', () => {
  let ipRestriction: { isIpAllowed: jest.Mock };
  let guard: IpRestrictionGuard;

  beforeEach(() => {
    ipRestriction = { isIpAllowed: jest.fn() };
    guard = new IpRestrictionGuard(ipRestriction as any);
  });

  it('allows a request with no authenticated user (public route)', async () => {
    await expect(guard.canActivate(buildContext({ user: undefined }))).resolves.toBe(true);
    expect(ipRestriction.isIpAllowed).not.toHaveBeenCalled();
  });

  it('allows a request when the IP is permitted', async () => {
    ipRestriction.isIpAllowed.mockResolvedValue(true);
    const context = buildContext({ user: { id: 'u1' }, ip: '203.0.113.5' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(ipRestriction.isIpAllowed).toHaveBeenCalledWith('203.0.113.5', 'u1');
  });

  it('throws ForbiddenException when the IP is not permitted', async () => {
    ipRestriction.isIpAllowed.mockResolvedValue(false);
    const context = buildContext({ user: { id: 'u1' }, ip: '198.51.100.1' });
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });
});
