import { Global, Module } from '@nestjs/common';
import { SecurityContextService } from './security-context.service';
import { RowLevelSecurityService } from './row-level-security.service';
import { FieldMaskingInterceptor } from './field-masking.interceptor';
import { EntityAccessGuard } from './entity-access.guard';

/**
 * Phase 2 — Enterprise Security foundation.
 *
 * `@Global()` so every existing and future module can inject
 * `SecurityContextService` / `RowLevelSecurityService` without importing
 * this module directly — mirrors how PrismaModule is wired. This is the
 * single reusable security layer other modules are expected to call into;
 * do not re-implement entity/department/cost-centre/project filtering
 * inside individual modules.
 *
 * FieldMaskingInterceptor and EntityAccessGuard are exported rather than
 * bound here as APP_INTERCEPTOR/APP_GUARD: both need to run AFTER
 * JwtAuthGuard has populated `request.user`, and Nest resolves multiple
 * APP_GUARD/APP_INTERCEPTOR providers in the order they appear in a single
 * module's `providers` array. AppModule already owns that ordering for
 * JwtAuthGuard → PermissionsGuard, so EntityAccessGuard is appended there
 * (see app.module.ts) and FieldMaskingInterceptor is added alongside
 * AuditInterceptor in main.ts's `useGlobalInterceptors()` call.
 */
@Global()
@Module({
  providers: [SecurityContextService, RowLevelSecurityService, FieldMaskingInterceptor, EntityAccessGuard],
  exports: [SecurityContextService, RowLevelSecurityService, FieldMaskingInterceptor, EntityAccessGuard],
})
export class SecurityModule {}
