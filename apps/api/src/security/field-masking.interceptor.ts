import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MASK_FIELDS_KEY, MaskFieldsSpec } from './decorators/mask-fields.decorator';
import { SecurityContextService } from './security-context.service';
import { SENSITIVE_FIELD_GROUPS, MASKED_VALUE } from './security.types';

/**
 * Field Level Security (Phase 2, section 2).
 *
 * Applied globally (see main.ts). A no-op for any route that doesn't
 * declare `@MaskFields(...)`, so it never touches modules that haven't
 * opted in yet. Routes opt in once, declaratively — no per-module masking
 * logic to maintain.
 */
@Injectable()
export class FieldMaskingInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly securityContext: SecurityContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const specs = this.reflector.getAllAndOverride<MaskFieldsSpec[]>(MASK_FIELDS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!specs || specs.length === 0) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    // No authenticated user (shouldn't happen behind JwtAuthGuard, but fail
    // safe): mask everything rather than risk leaking sensitive data.
    const groupsToMask = specs.filter((spec) => {
      const permissionCode = SENSITIVE_FIELD_GROUPS[spec.group];
      return !user || !this.securityContext.canViewSensitiveField(user, permissionCode);
    });

    if (groupsToMask.length === 0) {
      return next.handle();
    }

    const fieldNamesToMask = new Set(groupsToMask.flatMap((spec) => spec.fields));

    return next.handle().pipe(map((body) => maskDeep(body, fieldNamesToMask)));
  }
}

function maskDeep(value: unknown, fieldNamesToMask: Set<string>, depth = 0): unknown {
  if (value === null || value === undefined || depth > 10) return value;

  if (Array.isArray(value)) {
    return value.map((item) => maskDeep(item, fieldNamesToMask, depth + 1));
  }

  if (typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (fieldNamesToMask.has(key) && val !== null && val !== undefined) {
        result[key] = MASKED_VALUE;
      } else if (typeof val === 'object' && val !== null) {
        result[key] = maskDeep(val, fieldNamesToMask, depth + 1);
      } else {
        result[key] = val;
      }
    }
    return result;
  }

  return value;
}
