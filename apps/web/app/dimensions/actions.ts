'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface DimensionActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-3.2 — Dimensions, the second checkpoint of
 * Stage FE-3. `DimensionsController` (`/dimensions/*`) actually covers
 * eight sub-resources (Projects, Phases, Blocks, Floors, Units,
 * Departments, Cost Centers, Funding Sources, Vendors, Customers), but
 * only three have a `GET` list endpoint AND a flat, no-parent-required
 * shape a single page's tables can render directly: `findProjects`,
 * `findVendors`, `findCustomers` (confirmed directly against the
 * controller). Phases/Blocks/Floors/Units each require their parent's
 * id just to create one and have no list endpoint of their own at all;
 * Departments/Cost Centers/Funding Sources DO have list endpoints but
 * are simpler entity-scoped reference data with no other module
 * currently referencing them as a `TextField`-standing-in-for-a-Select
 * the way Project/Vendor/Customer already are (see below). This
 * checkpoint scopes to exactly those three — the same "smallest
 * correct slice, not the whole controller" discipline `boq/actions.ts`
 * and `general-ledger/actions.ts` both apply to their own multi-
 * resource backends.
 *
 * Projects, Vendors, and Customers are exactly the three registries
 * multiple existing forms already reference by a raw id `TextField`
 * with no picker to build a `Select` from at the time they were built
 * — `CreateBudgetForm`'s own doc comment names this gap directly for
 * its own project/department/cost-center/funding-source/vendor id
 * fields, and `project-risks`/`project-issues`' own `projectId`
 * `TextField`s predate `GET /dimensions/projects` being confirmed to
 * exist (see `CreateBoqForm`'s own doc comment on that re-verification).
 * This checkpoint does NOT retrofit those existing forms — that stays
 * its own later, unscoped checkpoint — it only builds the
 * Projects/Vendors/Customers registry pages themselves.
 *
 * `createProject` (`POST /dimensions/projects`, `dimension.manage`)
 * takes `entityId` — Project genuinely has an `entityId` column
 * (confirmed against `schema.prisma`), unlike Vendor/Customer, which
 * have none — so only this one of the three actions takes an
 * `entityId` argument, matching `Account`/`TaxCode`'s own precedent for
 * entity-scoped vs. shared reference data on the same page (see
 * `general-ledger/page.tsx`'s own doc comment).
 */
export async function createProject(input: {
  entityId: string;
  code: string;
  name: string;
  description?: string;
}): Promise<DimensionActionState> {
  try {
    await fetchApi('/dimensions/projects', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create project.' };
  }

  revalidatePath('/dimensions');
  return { ok: true };
}

export async function createVendor(input: {
  code: string;
  name: string;
  taxId?: string;
  bankName?: string;
  bankAccountNumber?: string;
}): Promise<DimensionActionState> {
  try {
    await fetchApi('/dimensions/vendors', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create vendor.' };
  }

  revalidatePath('/dimensions');
  return { ok: true };
}

export async function createCustomer(input: {
  code: string;
  name: string;
  email?: string;
  phone?: string;
}): Promise<DimensionActionState> {
  try {
    await fetchApi('/dimensions/customers', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create customer.' };
  }

  revalidatePath('/dimensions');
  return { ok: true };
}
