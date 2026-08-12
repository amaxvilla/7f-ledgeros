import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { IpRestrictionService } from './ip-restriction.service';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';

/**
 * Release P — IP Restrictions, enforced on every authenticated request.
 * Registered as a global APP_GUARD in app.module.ts, after JwtAuthGuard
 * (so request.user is populated) — same placement reasoning as
 * EntityAccessGuard. Unlike EntityAccessGuard, this one is NOT
 * decorator-gated: it runs for every non-@Public() route, because an IP
 * restriction that only applied to routes someone remembered to
 * annotate wouldn't actually restrict anything. A request with no
 * authenticated user (a @Public() route) is skipped — there's no
 * account to check rules against.
 */
@Injectable()
export class IpRestrictionGuard implements CanActivate {
  constructor(private readonly ipRestriction: IpRestrictionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) return true;

    const allowed = await this.ipRestriction.isIpAllowed(request.ip, user.id);
    if (!allowed) {
      throw new ForbiddenException('This IP address is not permitted to access this account');
    }
    return true;
  }
}
