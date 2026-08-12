import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RLS_BODY_CHECK_KEY, RlsBodyCheckSpec } from './decorators/rls-dimensions.decorator';
import { SecurityContextService } from './security-context.service';

/**
 * Dynamic Entity/Department/CostCentre/Project Access enforcement (Phase 2,
 * sections 4–7) for write paths where the target dimension id comes from
 * the request body. Registered globally (see security.module.ts); a no-op
 * unless a route declares `@RlsBodyCheck(...)`.
 */
@Injectable()
export class EntityAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly securityContext: SecurityContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const spec = this.reflector.getAllAndOverride<RlsBodyCheckSpec>(RLS_BODY_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!spec) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;
    if (!user) throw new ForbiddenException('No authenticated user on request');

    const dimensionId = getByPath(request.body, spec.bodyField);
    if (!dimensionId) return true; // DTO validation will reject a missing required id anyway

    const scope = await this.securityContext.buildScope(user);
    const dimensionScope = scope[spec.dimension];
    if (dimensionScope.unrestricted) return true;

    const allowedIds = spec.mode === 'post' ? dimensionScope.postableIds : dimensionScope.viewableIds;
    if (!allowedIds.includes(dimensionId)) {
      throw new ForbiddenException(
        `No ${spec.mode === 'post' ? 'post' : 'view'} access to this ${spec.dimension}`,
      );
    }

    return true;
  }
}

function getByPath(obj: unknown, path: string): string | undefined {
  return path.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), obj);
}
