'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface BankReconActionState {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Frontend Completion, FE-3.6 — Bank Reconciliation, sixth and final
 * checkpoint of Stage FE-3 (FE-3.5's own recommended next checkpoint).
 * `BankReconciliationController` has real `@Get` routes — unlike
 * Revenue Recognition — but only by id (`GET statements/:id`,
 * `GET sessions/:id`, `GET sessions/:id/summary`), never by entity
 * (confirmed directly, no `findAll`-shaped route exists at all). Every
 * prior FE-3 checkpoint reached for that same fact as a reason to
 * SKIP a resource (Bank Reconciliation's own sessions were named as
 * the reason in FE-3.1 through FE-3.5); this checkpoint instead builds
 * the id-entry pattern those write-ups kept deferring, since Bank
 * Reconciliation is the one remaining FE-3 resource and there's no
 * further module to defer it to within this stage.
 *
 * `importStatement` (`POST /bank-reconciliation/import`,
 * `bankrecon.manage`) and `createSession` (`POST
 * /bank-reconciliation/sessions`, same permission) both return the
 * created record — this file's two actions for them return `id` in
 * their `BankReconActionState` (unlike every purely-mutating action
 * elsewhere in this codebase, which returns only `{ ok, error }`) —
 * because with no list endpoint to browse afterward, the id IS the
 * result the user needs, the same "return the actual result on
 * success" shape `getStockBalance`'s own doc comment establishes for
 * read actions, extended here to two create actions specifically
 * because of the missing list endpoint.
 *
 * `bankAccountId` (on both `importStatement` and `createSession`)
 * refers to `BankAccount` — a model with NO list-by-entity endpoint
 * confirmed anywhere in this codebase (`bank-integration`'s own
 * `linked-accounts` is a different concept — Mono-provider-linked
 * accounts, not this `BankAccount` model, confirmed directly against
 * `schema.prisma`), so it stays a plain id field on both forms, the
 * same "no registry, don't invent one" restraint named in
 * `revenue-recognition/actions.ts`'s own doc comment for
 * `installmentLineId`/`unitId`.
 */
export async function importBankStatement(input: {
  entityId: string;
  bankAccountId: string;
  statementDate: string;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  closingBalance: number;
  lines: { transactionDate: string; description: string; reference?: string; amount: number }[];
}): Promise<BankReconActionState> {
  try {
    const statement = await fetchApi<{ id: string }>('/bank-reconciliation/import', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true, id: statement.id };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to import bank statement.' };
  }
}

export async function createReconciliationSession(input: {
  entityId: string;
  bankAccountId: string;
  statementId: string;
  bankGlAccountId: string;
  sessionDate: string;
}): Promise<BankReconActionState> {
  try {
    const session = await fetchApi<{ id: string }>('/bank-reconciliation/sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true, id: session.id };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create reconciliation session.' };
  }
}

export async function autoMatchSession(sessionId: string): Promise<BankReconActionState> {
  try {
    await fetchApi(`/bank-reconciliation/sessions/${sessionId}/auto-match`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to auto-match session.' };
  }

  revalidatePath('/bank-reconciliation');
  return { ok: true };
}

export async function manualMatchLine(
  sessionId: string,
  input: { bankStatementLineId: string; journalLineId: string; notes?: string },
): Promise<BankReconActionState> {
  try {
    await fetchApi(`/bank-reconciliation/sessions/${sessionId}/manual-match`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to record manual match.' };
  }

  revalidatePath('/bank-reconciliation');
  return { ok: true };
}

export async function recordAdjustment(
  sessionId: string,
  input: { bankStatementLineId: string; adjustmentType: 'BANK_CHARGE' | 'INTEREST_INCOME'; contraAccountId: string },
): Promise<BankReconActionState> {
  try {
    await fetchApi(`/bank-reconciliation/sessions/${sessionId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to record adjustment.' };
  }

  revalidatePath('/bank-reconciliation');
  return { ok: true };
}

export async function approveSession(sessionId: string): Promise<BankReconActionState> {
  try {
    await fetchApi(`/bank-reconciliation/sessions/${sessionId}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve session.' };
  }

  revalidatePath('/bank-reconciliation');
  return { ok: true };
}
