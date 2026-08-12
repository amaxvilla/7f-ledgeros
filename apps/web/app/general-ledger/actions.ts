'use server';

import { revalidatePath } from 'next/cache';
import { fetchApi, ApiError } from '../../lib/api';

export interface GlActionState {
  ok: boolean;
  error?: string;
}

/**
 * Frontend Completion, FE-3.1 — General Ledger, the first page for
 * Stage FE-3 (Finance Modules). Of the eight FE-3 domains without a
 * page yet (General Ledger, Chart of Accounts, Dimensions, Procurement,
 * Inventory, Bank Reconciliation, Revenue Recognition — Budgeting/AP-AR/
 * Treasury/Fixed Assets/Tax already shipped), General Ledger is picked
 * first: every other Finance module ultimately posts through it
 * (`PostingEngineService`), and Chart of Accounts (`ChartOfAccountsController`,
 * `/accounts`) is inseparable from it in practice — a journal line
 * always needs an account to post to — so this single checkpoint covers
 * both `GeneralLedgerController` (`/gl/*`) and `ChartOfAccountsController`
 * (`/accounts`) together rather than splitting them across two
 * checkpoints that would each need the other's data to be useful.
 *
 * `createAccount` (`POST /accounts`, `coa.manage`) mirrors
 * `createTaxCode`'s own shape: Account, like TaxCode, is shared
 * reference data with no `entityId` field on `CreateAccountDto` at all
 * (confirmed directly against the DTO) — activating an account FOR an
 * entity is a separate endpoint (`POST /accounts/activate-for-entity`)
 * deliberately left out of this checkpoint's scope, the same
 * "smallest correct slice, not the whole chain" discipline `boq/actions.ts`
 * applied to BOQ vs. the rest of the PMO document chain.
 *
 * `createJournalEntry` (`POST /gl/journal-entries`, `gl.journal.create`)
 * always creates a `DRAFT` entry — `PostingEngineService.createDraft`,
 * confirmed directly. The five workflow actions below
 * (`submit`/`approve`/`reject`/`post`/`reverse`) mirror
 * `GeneralLedgerController`'s own five distinct endpoints exactly —
 * unlike BOQ's single `advance` endpoint with a caller-supplied target,
 * GL's workflow has no equivalent generic endpoint (confirmed directly:
 * five separate `@Post` routes, each gated by its own permission —
 * `gl.journal.create` for submit, `gl.journal.approve` for
 * approve/reject, `gl.journal.post` for post/reverse), so this file has
 * five matching functions instead of one.
 */
export async function createAccount(input: {
  code: string;
  name: string;
  accountType: string;
  accountCategory: string;
  ifrsMapping?: string;
  parentAccountId?: string;
}): Promise<GlActionState> {
  try {
    await fetchApi('/accounts', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create account.' };
  }

  revalidatePath('/general-ledger');
  return { ok: true };
}

export async function createJournalEntry(input: {
  entityId: string;
  entryDate: string;
  description: string;
  lines: { accountId: string; debit: number; credit: number; memo?: string }[];
}): Promise<GlActionState> {
  try {
    await fetchApi('/gl/journal-entries', { method: 'POST', body: JSON.stringify(input) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to create journal entry.' };
  }

  revalidatePath('/general-ledger');
  return { ok: true };
}

export async function submitJournalEntry(id: string): Promise<GlActionState> {
  try {
    await fetchApi(`/gl/journal-entries/${id}/submit`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to submit journal entry.' };
  }

  revalidatePath('/general-ledger');
  return { ok: true };
}

export async function approveJournalEntry(id: string): Promise<GlActionState> {
  try {
    await fetchApi(`/gl/journal-entries/${id}/approve`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to approve journal entry.' };
  }

  revalidatePath('/general-ledger');
  return { ok: true };
}

export async function rejectJournalEntry(id: string): Promise<GlActionState> {
  try {
    await fetchApi(`/gl/journal-entries/${id}/reject`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reject journal entry.' };
  }

  revalidatePath('/general-ledger');
  return { ok: true };
}

export async function postJournalEntry(id: string): Promise<GlActionState> {
  try {
    await fetchApi(`/gl/journal-entries/${id}/post`, { method: 'POST' });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to post journal entry.' };
  }

  revalidatePath('/general-ledger');
  return { ok: true };
}

export async function reverseJournalEntry(id: string): Promise<GlActionState> {
  try {
    await fetchApi(`/gl/journal-entries/${id}/reverse`, { method: 'POST', body: JSON.stringify({}) });
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.message : 'Failed to reverse journal entry.' };
  }

  revalidatePath('/general-ledger');
  return { ok: true };
}
