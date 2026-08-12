import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Fire-and-forget audit trail for every mutating request that reaches a
 * controller. Module-specific writes (e.g. journal posting) additionally
 * write richer, transaction-scoped audit rows directly — this interceptor
 * is the safety net that guarantees nothing mutating goes unlogged.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, ip } = request;

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        this.prisma.auditLog
          .create({
            data: {
              userId: user?.id ?? null,
              action: `${method} ${url}`,
              entityType: context.getClass().name.replace('Controller', ''),
              entityId: (responseBody as any)?.id ?? 'unknown',
              afterState: safeJson(responseBody),
              ipAddress: ip,
            },
          })
          .catch(() => {
            // Audit logging must never break the primary request lifecycle.
          });
      }),
    );
  }
}

function safeJson(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}
