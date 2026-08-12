import { SetMetadata } from '@nestjs/common';
import { SecurityDimension } from '../security.types';

export const RLS_BODY_CHECK_KEY = 'rlsBodyCheck';

export interface RlsBodyCheckSpec {
  dimension: SecurityDimension;
  /** Dot path into the request body where the id lives, e.g. 'entityId' or
   *  'lines.0.projectId'. Most write DTOs put it at the top level. */
  bodyField: string;
  mode?: 'view' | 'post';
}

/**
 * Declares that `EntityAccessGuard` should verify the caller's RLS scope
 * permits the dimension id found at `bodyField` in the request body, before
 * the handler runs. Use on create/update routes where the target
 * entity/department/cost-centre/project comes from the request body rather
 * than being looked up from an existing row (for existing rows, call
 * `RowLevelSecurityService.canAccess()` directly in the service instead).
 *
 * Example:
 *   @RlsBodyCheck({ dimension: 'entity', bodyField: 'entityId', mode: 'post' })
 *   @Post()
 *   create(@Body() dto: CreateJournalEntryDto) { ... }
 */
export const RlsBodyCheck = (spec: RlsBodyCheckSpec) => SetMetadata(RLS_BODY_CHECK_KEY, spec);
