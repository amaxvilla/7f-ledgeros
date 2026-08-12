'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface BudgetActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion — Budgeting Register (BUD.1)'s one write path.
 * Same `fetchApi` + `revalidatePath('/budgeting')` shape every other
 * module page's `actions.ts` already uses. `createBudget` (BUD.2) added
 * below — see `CreateBudgetForm.tsx`'s own doc comment for why it took
 * a separate checkpoint from `submit` above.
 */
export async function submitBudget(id: string): Promise<BudgetActionState> {
  try {
    await fetchApi(`/budgets/${id}/submit`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to submit budget.' };
  }

  revalidatePath('/budgeting');
  return { ok: true };
}

/**
 * Frontend Completion (FIX.2's own recommended next checkpoint) —
 * `approve`/`reject` (`BudgetingController.approve`/`.reject`, confirmed
 * directly). Both take the same `BudgetDecisionDto` shape: a single
 * optional `comments` string, nothing else — unlike `createBudget`
 * above, there's no nested array here, so these stay simple
 * `id + optional string` functions rather than needing their own input
 * interface the way `createBudget`'s `lines` did.
 *
 * Both are only ever callable from `SUBMITTED` (confirmed directly
 * against `BudgetingService.approve`/`.reject`'s own `assertStatus`
 * calls) — `BudgetDecisionActions.tsx` is the only caller, and only
 * renders for that one status, the same "don't offer what the backend
 * would reject" posture `SubmitBudgetButton`'s own doc comment already
 * established for `submit`.
 */
export async function approveBudget(id: string, comments?: string): Promise<BudgetActionState> {
  try {
    await fetchApi(`/budgets/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(comments ? { comments } : {}),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve budget.' };
  }

  revalidatePath('/budgeting');
  return { ok: true };
}

export async function rejectBudget(id: string, comments?: string): Promise<BudgetActionState> {
  try {
    await fetchApi(`/budgets/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(comments ? { comments } : {}),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject budget.' };
  }

  revalidatePath('/budgeting');
  return { ok: true };
}

/**
 * Frontend Completion (BUD.3's own recommended next checkpoint) —
 * `close` (`BudgetingController.close`, confirmed directly against
 * `BudgetingService.close`). Takes no body at all — unlike
 * `approve`/`reject`'s optional `comments`, `close` writes its own
 * fixed `'Budget closed at year end'` comment server-side
 * (`BudgetingService.close`'s own `budgetApproval.create` call) — so
 * this stays a plain `id`-only function, the same shape `submitBudget`
 * already has.
 *
 * Only ever callable from `APPROVED` (confirmed directly against
 * `BudgetingService.close`'s own `assertStatus` guard) — one status
 * later than `approve`/`reject`'s own `SUBMITTED` gate.
 * `CloseBudgetButton.tsx` is the only caller, and only renders for that
 * one status.
 */
export async function closeBudget(id: string): Promise<BudgetActionState> {
  try {
    await fetchApi(`/budgets/${id}/close`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to close budget.' };
  }

  revalidatePath('/budgeting');
  return { ok: true };
}

export async function createBudget(input: {
  entityId: string;
  code: string;
  name: string;
  fiscalYear: number;
  description?: string;
  lines: { accountId: string; period: number; amount: number }[];
}): Promise<BudgetActionState> {
  try {
    await fetchApi('/budgets', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create budget.' };
  }

  revalidatePath('/budgeting');
  return { ok: true };
}

/**
 * Frontend Completion (BUD.5's own recommended next checkpoint) —
 * `revise` (`BudgetingController.revise`, confirmed directly against
 * `BudgetingService.revise`). Takes `ReviseBudgetDto`: a required
 * `reason` string plus `lines: { budgetLineId, newAmount }[]`
 * (`ArrayMinSize(1)`) — the same nested-array shape `createBudget`
 * above already has, which is why this takes a single `input` object
 * rather than `approveBudget`/`rejectBudget`'s plain scalar arguments.
 *
 * Only ever callable from `APPROVED` (confirmed directly against
 * `BudgetingService.revise`'s own `assertStatus` guard) —
 * `ReviseBudgetForm.tsx` is the only caller, and `/budgeting/[id]/page.tsx`
 * only renders that form for that one status.
 *
 * Revalidates both the detail page itself (so its Line items/Revision
 * history tables reflect the new `revisedAmount`/revision row
 * immediately) and the register (`/budgeting`), the same two-path
 * revalidation `submitBudget`/`approveBudget` etc. already do for their
 * own single path — this is the first action in this file whose effect
 * is visible on two different routes at once.
 */
export async function reviseBudget(
  id: string,
  input: { reason: string; lines: { budgetLineId: string; newAmount: number }[] },
): Promise<BudgetActionState> {
  try {
    await fetchApi(`/budgets/${id}/revise`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to revise budget.' };
  }

  revalidatePath(`/budgeting/${id}`);
  revalidatePath('/budgeting');
  return { ok: true };
}

/**
 * Frontend Completion (BUD.6's own recommended next checkpoint) —
 * `transfer` (`BudgetingController.transfer`, confirmed directly
 * against `BudgetingService.transfer`). Takes `TransferBudgetDto`: a
 * flat `{ fromLineId, toLineId, amount, reason }` — no nested array,
 * unlike `reviseBudget` above, so this takes the same plain-object-of-
 * scalars shape `approveBudget`/`rejectBudget` use, just with more
 * fields.
 *
 * Only ever callable from `APPROVED` (confirmed directly against
 * `BudgetingService.transfer`'s own `assertStatus` guard — the same
 * gate `revise` uses) — `TransferBudgetForm.tsx` is the only caller,
 * and `/budgeting/[id]/page.tsx` only renders that form for that one
 * status, same condition it already applies to `ReviseBudgetForm`.
 *
 * Revalidates both `/budgeting/${id}` and `/budgeting`, same two-path
 * shape `reviseBudget` already established — this action changes two
 * lines' `revisedAmount` at once, visible on both routes.
 */
export async function transferBudget(
  id: string,
  input: { fromLineId: string; toLineId: string; amount: number; reason: string },
): Promise<BudgetActionState> {
  try {
    await fetchApi(`/budgets/${id}/transfer`, { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to transfer budget.' };
  }

  revalidatePath(`/budgeting/${id}`);
  revalidatePath('/budgeting');
  return { ok: true };
}
