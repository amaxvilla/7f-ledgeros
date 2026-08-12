import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  id: string;
  email: string;
  permissions: string[];
  entityAccess: { entityId: string; canPost: boolean; canView: boolean }[];
  /**
   * Phase 2 — Row Level Security. Optional so existing code paths that only
   * ever read the fields above (id/email/permissions/entityAccess) keep
   * compiling and behaving exactly as before. Populated by JwtStrategy;
   * consumed by SecurityContextService rather than read directly by
   * controllers/services.
   */
  departmentAccess?: { departmentId: string; canPost: boolean; canView: boolean }[];
  costCenterAccess?: { costCenterId: string; canPost: boolean; canView: boolean }[];
  projectAccess?: { projectId: string; canPost: boolean; canView: boolean }[];
  /** Phase 2 — Business Unit dimension. Raw grants only (Business Unit ids,
   *  not the Entity ids under them) — SecurityContextService resolves those
   *  at scope-build time so the resolution always reflects the current
   *  Entity → Business Unit assignment rather than whatever it was when the
   *  JWT was issued. */
  businessUnitAccess?: { businessUnitId: string; canPost: boolean; canView: boolean }[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
