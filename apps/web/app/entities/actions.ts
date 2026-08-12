'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface EntityActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-8.2 — Entities, the roadmap's own first-listed
 * FE-8 item, picked over the other standing candidate
 * (`flagOverdueCorrectiveActions`) after reading both directly: the
 * latter isn't actually part of the Queue module at all — it's an HSE
 * endpoint (`POST /hse/corrective-actions/flag-overdue`) with no
 * natural backend home under `queue/` (confirmed directly — `queue/`
 * has `jobs.controller.ts`/`job-runs.controller.ts`, neither related)
 * — a speculative "likely Queue or System Configuration" guess from an
 * earlier report that doesn't hold up once actually checked. Entities
 * is a real, complete, well-scoped CRUD module by contrast.
 *
 * **A genuine correction of a plausible-sounding assumption**: before
 * this checkpoint, it would have been reasonable to assume
 * `EntitySelector.tsx` (used all over this app to scope pages to an
 * entity) already fetches `GET /entities` for a dropdown. Read it
 * directly instead — it's a raw text `<input>` for typing an entity id
 * by hand, no fetch at all. This checkpoint's own `page.tsx` is
 * therefore the FIRST real frontend consumer of `GET /entities`
 * anywhere in this app, not a second one layered on an existing fetch.
 *
 * `createEntity` (`POST /entities`, `entity.manage`) requires `code`/
 * `name`/`legalName`; `taxIdentificationNumber`/`registrationNumber`/
 * `baseCurrency`/`fiscalYearStartMonth`/`parentEntityId`/
 * `isConsolidationParent` are all optional, each with a real
 * server-side default (`baseCurrency` → `"NGN"`, `fiscalYearStartMonth`
 * → `1`, `isConsolidationParent` → `false`, confirmed directly in
 * `EntitiesService.create`, not just the schema's own `@default`) —
 * left as `undefined` when blank rather than this form re-supplying
 * the same defaults client-side. `code` uniqueness and `parentEntityId`
 * existence are both server-validated (`ConflictException`/
 * `NotFoundException`, confirmed directly) — not duplicated client-side,
 * the same "let the backend validate, surface its error" posture this
 * app takes throughout.
 *
 * `deactivateEntity` (`DELETE /entities/:id`, `entity.manage`) is a
 * SOFT delete (`isActive: false`, confirmed directly — the row is never
 * removed) with no corresponding "reactivate" endpoint anywhere on
 * `EntitiesController` — a genuinely terminal, one-way transition, the
 * same shape `deactivateIpRule` already established; `DeactivateEntityButton.tsx`
 * mirrors `DeactivateIpRuleButton.tsx` directly rather than inventing a
 * new terminal-action shape.
 *
 * NOW BUILT (was deferred at FE-8.2): `update` (`PATCH /entities/:id`,
 * full field-by-field editing) and `getHierarchyChain`
 * (`GET /entities/:id/hierarchy`) both live at `/entities/[id]` now —
 * see that route's own `actions.ts` (a separate file, not added here —
 * this file stays scoped to the register's own two actions,
 * `createEntity`/`deactivateEntity`, the same one-actions-file-per-route
 * shape `/work-packages` vs. `/work-packages/[id]` already established).
 */
export async function createEntity(input: {
  code: string;
  name: string;
  legalName: string;
  taxIdentificationNumber?: string;
  registrationNumber?: string;
  baseCurrency?: string;
  fiscalYearStartMonth?: number;
  parentEntityId?: string;
  isConsolidationParent?: boolean;
}): Promise<EntityActionState> {
  try {
    await fetchApi('/entities', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create entity.' };
  }

  revalidatePath('/entities');
  return { ok: true };
}

export async function deactivateEntity(id: string): Promise<EntityActionState> {
  try {
    await fetchApi(`/entities/${id}`, { method: 'DELETE' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to deactivate entity.' };
  }

  revalidatePath('/entities');
  return { ok: true };
}
