import { Badge, DataTable, KpiCard, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, formatCurrency, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { CreateAccountForm } from './CreateAccountForm';
import { CreateJournalEntryForm } from './CreateJournalEntryForm';
import { JournalEntryStatusActions } from './JournalEntryStatusActions';

export const dynamic = 'force-dynamic';

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
  accountCategory: string;
  isActive: boolean;
}

interface JournalLine {
  id: string;
  accountId: string;
  debit: string | number;
  credit: string | number;
  memo: string | null;
}

interface JournalEntry {
  id: string;
  journalNumber: string;
  entryDate: string;
  description: string;
  status: string;
  lines: JournalLine[];
}

interface TrialBalance {
  entityId: string;
  fiscalPeriodId: string | null;
  rows: { accountId: string; code: string; name: string; debit: number; credit: number }[];
  totals: { debit: number; credit: number };
}

const STATUS_TONE: Record<string, 'positive' | 'negative' | 'warning' | 'neutral'> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'warning',
  POSTED: 'positive',
  REVERSED: 'negative',
  REJECTED: 'negative',
};

/**
 * Frontend Completion, FE-3.1 — General Ledger, opening Stage FE-3
 * (Finance Modules). See `actions.ts`'s own doc comment for why this
 * checkpoint scopes to BOTH `GeneralLedgerController` (`/gl/*`) and
 * `ChartOfAccountsController` (`/accounts`) together rather than
 * splitting them.
 *
 * Chart of Accounts is rendered UNGATED by `entityId` — same "shared
 * reference data, not entity-scoped" shape `tax/page.tsx`'s own Tax
 * Codes table already established for `TaxCode` (confirmed directly:
 * `Account` has no `entityId` column either). Journal Entries and the
 * Trial Balance ARE entity-scoped (`GET /gl/journal-entries?entityId=`,
 * `GET /gl/trial-balance?entityId=`) and stay gated behind
 * `EntitySelector`, matching Budgeting/AP-AR's own split-gating
 * pattern for genuinely entity-scoped data.
 *
 * `accountOptions` (fetched unconditionally, same as the Chart of
 * Accounts table itself) feeds `CreateJournalEntryForm`'s per-line
 * `Select` — a journal line's `accountId` must reference a real GL
 * account, so this is the same "fetch in the Server Component, pass
 * the array down" shape `CreateBoqForm`'s own `projectOptions` uses.
 *
 * Trial Balance is rendered as four KPI cards (total debit, total
 * credit, balanced-or-not, row count) rather than the full per-account
 * breakdown table — a deliberate smaller first slice; the full
 * drill-down table is straightforward to add in a later checkpoint once
 * this page's own account/journal tables have shipped and can be
 * reused as the visual template, the same "smallest correct slice"
 * discipline `boq/actions.ts` names for BOQ vs. the rest of the PMO
 * chain.
 *
 * ADDENDUM (verification pass, following FE-5.5's own recommendation to
 * resolve the install/test gap before further feature work): the first
 * real `tsc --noEmit` run against this file in this repository's own
 * history (4 checkpoints had gone by with no network access to run
 * one) surfaced one genuine error here — `entityId` (typed
 * `string | undefined` from `searchParams.entityId?`) was passed
 * directly to `CreateJournalEntryForm`'s required `entityId: string`
 * prop inside the `{data && (...)}` block below. `data`'s own
 * truthiness does correctly imply `entityId` was defined (`data` is
 * only ever set inside `if (entityId) { ... }` above), but TypeScript
 * has no way to know that from `data`'s own type alone — the two
 * variables aren't linked. Fixed by having `loadGeneralLedgerData`
 * return the `entityId` it was called with, so the JSX below reads
 * `data.entityId` (narrowed for free by `data`'s own truthiness)
 * instead of the outer, still-possibly-`undefined` variable. No
 * behavior change — `data.entityId` and the outer `entityId` are always
 * the same string whenever `data` is non-null.
 *
 * ADDENDUM (FC-1.2) — the Chart of Accounts table now opts into
 * `DataTable`'s new `search` prop (`getText` joins `code`/`name`,
 * matching what a person actually recognizes an account by), as this
 * checkpoint's one real, working demonstration of the new primitive —
 * see `DataTable.tsx`'s own doc comment for why it's opt-in rather than
 * automatic everywhere. The Journal Entries table above is deliberately
 * left as-is: it's already entity-scoped and typically short-lived
 * (a period's worth of entries), so search adds less value there than
 * on this shared, cross-entity, potentially-large reference list.
 */
async function loadGeneralLedgerData(entityId: string) {
  const [journalEntries, trialBalance] = await Promise.all([
    fetchApi<JournalEntry[]>(`/gl/journal-entries?entityId=${entityId}`),
    fetchApi<TrialBalance>(`/gl/trial-balance?entityId=${entityId}`),
  ]);
  return { entityId, journalEntries, trialBalance };
}

function lineTotal(lines: JournalLine[], field: 'debit' | 'credit'): number {
  return lines.reduce((sum, l) => sum + Number(l[field]), 0);
}

export default async function GeneralLedgerPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let accounts: Account[] | null = null;
  let accountsError: string | null = null;
  try {
    accounts = await fetchApi<Account[]>('/accounts?activeOnly=true');
  } catch (e) {
    accountsError = e instanceof ApiError ? e.message : 'Failed to load chart of accounts.';
  }

  const accountOptions: SelectOption[] = (accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  let data: Awaited<ReturnType<typeof loadGeneralLedgerData>> | null = null;
  let dataError: string | null = null;
  if (entityId) {
    try {
      data = await loadGeneralLedgerData(entityId);
    } catch (e) {
      dataError = e instanceof ApiError ? e.message : 'Failed to load journal entries.';
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="General Ledger"
        subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to view journal entries and the trial balance.'}
      />
      <EntitySelector initialValue={entityId} />

      {entityId && dataError && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(6) }}>
          {dataError}
        </div>
      )}

      {data && (
        <>
          <section style={{ marginBottom: tokens.space(8) }}>
            <PageHeader title="Trial balance" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: tokens.space(4) }}>
              <KpiCard label="Total debit" value={formatCurrency(data.trialBalance.totals.debit)} />
              <KpiCard label="Total credit" value={formatCurrency(data.trialBalance.totals.credit)} />
              <KpiCard
                label="Balanced"
                value={data.trialBalance.totals.debit === data.trialBalance.totals.credit ? 'Yes' : 'No'}
                tone={data.trialBalance.totals.debit === data.trialBalance.totals.credit ? 'positive' : 'negative'}
              />
              <KpiCard label="Accounts with posted activity" value={String(data.trialBalance.rows.length)} />
            </div>
          </section>

          <section>
            <PageHeader title="Journal entries" />
            <CreateJournalEntryForm entityId={data.entityId} accountOptions={accountOptions} />
            <DataTable
              columns={[
                { header: 'Journal #', render: (r: JournalEntry) => r.journalNumber },
                { header: 'Date', render: (r: JournalEntry) => new Date(r.entryDate).toLocaleDateString() },
                { header: 'Description', render: (r: JournalEntry) => r.description },
                { header: 'Debit', align: 'right', render: (r: JournalEntry) => formatCurrency(lineTotal(r.lines, 'debit')) },
                { header: 'Credit', align: 'right', render: (r: JournalEntry) => formatCurrency(lineTotal(r.lines, 'credit')) },
                { header: 'Status', render: (r: JournalEntry) => <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge> },
                { header: 'Actions', align: 'right', render: (r: JournalEntry) => <JournalEntryStatusActions id={r.id} status={r.status} /> },
              ]}
              rows={data.journalEntries}
              keyOf={(r) => r.id}
              emptyMessage="No journal entries for this entity yet."
            />
          </section>
        </>
      )}

      <section>
        <PageHeader title="Chart of accounts" subtitle="Shared reference data — not entity-specific." />
        <CreateAccountForm />
        {accountsError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {accountsError}
          </div>
        )}
        {accounts && (
          <DataTable
            columns={[
              { header: 'Code', render: (a: Account) => a.code },
              { header: 'Name', render: (a: Account) => a.name },
              { header: 'Type', render: (a: Account) => a.accountType },
              { header: 'Category', render: (a: Account) => a.accountCategory },
              { header: 'Status', render: (a: Account) => <Badge tone={a.isActive ? 'positive' : 'neutral'}>{a.isActive ? 'Active' : 'Inactive'}</Badge> },
            ]}
            rows={accounts}
            keyOf={(a) => a.id}
            emptyMessage="No accounts configured yet."
            search={{ getText: (a) => `${a.code} ${a.name}`, placeholder: 'Search by code or name…' }}
          />
        )}
      </section>
    </PageContainer>
  );
}
