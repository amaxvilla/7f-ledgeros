import { Injectable } from '@nestjs/common';
import { SecurityDimension, SecurityScope } from './security.types';

/** Prisma field name each dimension maps to. Models vary in which of these
 *  foreign keys they actually have — callers declare which apply via
 *  `dimensions` in RlsFilterOptions. */
const DIMENSION_FIELD: Record<SecurityDimension, string> = {
  entity: 'entityId',
  department: 'departmentId',
  costCenter: 'costCenterId',
  project: 'projectId',
  // Business Unit has no FK column of its own on transactional tables — it
  // is resolved (in SecurityContextService) down to the set of Entity ids
  // under the granted Business Units, then enforced through the same
  // `entityId` column the `entity` dimension already uses. Declaring both
  // 'entity' and 'businessUnit' in `dimensions` for a model just ANDs two
  // id-sets together against that one column.
  businessUnit: 'entityId',
};

export interface RlsFilterOptions {
  /** Which dimensions this model actually has FK columns for. e.g. a
   *  JournalLine has all four; an Employee only has entity + department. */
  dimensions: SecurityDimension[];
  /** 'view' (default) checks viewableIds; 'post' checks postableIds — use
   *  'post' when building the where-clause for a create/update/approve/post
   *  action so a view-only grant can't be used to mutate. */
  mode?: 'view' | 'post';
}

/**
 * Centralized Row Level Security. Every module should call
 * `buildWhere()` and merge the result into its Prisma `where` clause rather
 * than hand-rolling entity/department/cost-centre/project filtering.
 *
 * Usage:
 *   const rls = this.rowLevelSecurity.buildWhere(scope, { dimensions: ['entity', 'department'] });
 *   return this.prisma.employee.findMany({ where: { ...rls, isActive: true } });
 */
@Injectable()
export class RowLevelSecurityService {
  /**
   * Builds a Prisma `where` fragment (an object with `AND: [...]`) that
   * restricts results to what `scope` permits, for each dimension the
   * caller says the model has.
   *
   * - A dimension the user is `unrestricted` on contributes no filter.
   * - A restricted dimension with grants contributes `{ [field]: { in: ids } }`.
   * - A restricted dimension with ZERO grants contributes `{ [field]: { in: [] } }`
   *   (i.e. matches nothing) — fail closed rather than fail open.
   */
  buildWhere(scope: SecurityScope, options: RlsFilterOptions): Record<string, unknown> {
    const mode = options.mode ?? 'view';
    const clauses: Record<string, unknown>[] = [];

    for (const dimension of options.dimensions) {
      const dimensionScope = scope[dimension];
      if (dimensionScope.unrestricted) continue;

      const ids = mode === 'post' ? dimensionScope.postableIds : dimensionScope.viewableIds;
      const field = DIMENSION_FIELD[dimension];
      clauses.push({ [field]: { in: ids } });
    }

    if (clauses.length === 0) return {};
    if (clauses.length === 1) return clauses[0];
    return { AND: clauses };
  }

  /**
   * Throws-free check for a single record already fetched (e.g. before a
   * mutation), rather than filtering a list query. Use when you've already
   * loaded a row by primary key and need to verify the caller may act on it.
   *
   * Accepts `string | null | undefined` per field — nullable Prisma FK
   * columns type as `string | null`, but callers also build this object
   * from optional DTO/function params (`string | undefined`) or from
   * Prisma `select`/computed values that can be `undefined`. Both mean
   * the same thing here ("this row doesn't populate this FK"), handled
   * identically by the `!value` check below.
   */
  canAccess(
    scope: SecurityScope,
    record: Partial<Record<'entityId' | 'departmentId' | 'costCenterId' | 'projectId', string | null | undefined>>,
    options: RlsFilterOptions,
  ): boolean {
    const mode = options.mode ?? 'view';

    return options.dimensions.every((dimension) => {
      const dimensionScope = scope[dimension];
      if (dimensionScope.unrestricted) return true;

      const field = DIMENSION_FIELD[dimension] as keyof typeof record;
      const value = record[field];
      if (!value) return true; // model doesn't populate this FK for this row

      const ids = mode === 'post' ? dimensionScope.postableIds : dimensionScope.viewableIds;
      return ids.includes(value);
    });
  }
}
