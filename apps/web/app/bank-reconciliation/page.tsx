import { Badge, DataTable, PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { ImportStatementForm } from './ImportStatementForm';
import { CreateSessionForm } from './CreateSessionForm';
import { SessionSelector } from './SessionSelector';
import { SessionActions } from './SessionActions';
import { ManualMatchForm } from './ManualMatchForm';
import { RecordAdjustmentForm } from './RecordAdjustmentForm';

export const dynamic = 'force-dynamic';

interface Account {
  id: string;
  code: string;
  name: string;
}

interface UnmatchedStatementLine {
  id: string;
  transactionDate: string;
  description: string;
  amount: number;
  classification: string;
}

interface UnmatchedBookLine {
  id: string;
  entryDate: string;
  debit: number;
  credit: number;
  classification: string;
}

interface SessionSummary {
  sessionId: string;
  status: string;
  matchedCount: number;
  unmatchedStatementLines: UnmatchedStatementLine[];
  unmatchedBookLines: UnmatchedBookLine[];
}

/**
 * Frontend Completion, FE-3.6 — Bank Reconciliation, sixth and final
 * checkpoint of Stage FE-3. See `actions.ts`'s own doc comment for why
 * this page is shaped around id-entry (`SessionSelector`) rather than a
 * `DataTable`.
 *
 * Two independent gates on this page: `entityId` (via `EntitySelector`)
 * for the entity-scoped create flows (`ImportStatementForm`,
 * `CreateSessionForm` — both `RlsBodyCheck`'d on `entityId`, confirmed
 * directly), and `sessionId` (via `SessionSelector`) for the
 * id-addressable session workspace (`getSessionSummary`, which takes no
 * `entityId` at all — a session's entity is implicit in the session
 * itself). A person can arrive with either, both, or neither in the
 * URL; each section renders independently once its own gate is
 * satisfied.
 *
 * `statementLineOptions`/`bookLineOptions` are both derived from the
 * SAME `getSessionSummary` fetch that renders this page's two unmatched
 * tables — fetched once, passed to `ManualMatchForm`/`RecordAdjustmentForm`
 * as `SelectOption[]`, the same "fetch once, pass down" shape every
 * other FE-3 page uses for its own registries.
 */
export default async function BankReconciliationPage({ searchParams }: { searchParams: { entityId?: string; sessionId?: string } }) {
  const entityId = searchParams.entityId;
  const sessionId = searchParams.sessionId;

  let accounts: Account[] | null = null;
  let accountsError: string | null = null;
  try {
    accounts = await fetchApi<Account[]>('/accounts?activeOnly=true');
  } catch (e) {
    accountsError = e instanceof ApiError ? e.message : 'Failed to load chart of accounts.';
  }
  const accountOptions: SelectOption[] = (accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  let summary: SessionSummary | null = null;
  let summaryError: string | null = null;
  if (sessionId) {
    try {
      summary = await fetchApi<SessionSummary>(`/bank-reconciliation/sessions/${sessionId}/summary`);
    } catch (e) {
      summaryError = e instanceof ApiError ? e.message : 'Failed to load session summary.';
    }
  }

  const statementLineOptions: SelectOption[] = (summary?.unmatchedStatementLines ?? []).map((l) => ({
    value: l.id,
    label: `${new Date(l.transactionDate).toLocaleDateString()} — ${l.description} (${l.amount})`,
  }));
  const bookLineOptions: SelectOption[] = (summary?.unmatchedBookLines ?? []).map((l) => ({
    value: l.id,
    label: `${new Date(l.entryDate).toLocaleDateString()} — Dr ${l.debit} / Cr ${l.credit}`,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Import a statement, open a session against it, then work the session by its ID — this module has no list view."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Bank Reconciliation' }]}
      />

      {accountsError && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
          {accountsError}
        </div>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="1. Import a bank statement" subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to import a statement.'} />
        <EntitySelector initialValue={entityId} />
        {entityId && <ImportStatementForm entityId={entityId} />}
      </section>

      {entityId && (
        <section style={{ marginBottom: tokens.space(8) }}>
          <PageHeader title="2. Open a reconciliation session" />
          <CreateSessionForm entityId={entityId} accountOptions={accountOptions} />
        </section>
      )}

      <section>
        <PageHeader title="3. Work a session" />
        <SessionSelector entityId={entityId} initialValue={sessionId} />

        {summaryError && (
          <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
            {summaryError}
          </div>
        )}

        {summary && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: tokens.space(4), marginBottom: tokens.space(4) }}>
              <Badge tone={summary.status === 'APPROVED' ? 'positive' : 'warning'}>{summary.status}</Badge>
              <span style={{ fontFamily: tokens.font.body, fontSize: '13px', color: tokens.color.textMuted }}>
                {summary.matchedCount} matched line{summary.matchedCount === 1 ? '' : 's'}
              </span>
              <SessionActions sessionId={summary.sessionId} status={summary.status} />
            </div>

            {summary.status === 'DRAFT' && (
              <>
                <ManualMatchForm sessionId={summary.sessionId} statementLineOptions={statementLineOptions} bookLineOptions={bookLineOptions} />
                <RecordAdjustmentForm sessionId={summary.sessionId} statementLineOptions={statementLineOptions} accountOptions={accountOptions} />
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: tokens.space(6) }}>
              <div>
                <PageHeader title="Unmatched statement lines" />
                <DataTable
                  columns={[
                    { header: 'Date', render: (l: UnmatchedStatementLine) => new Date(l.transactionDate).toLocaleDateString() },
                    { header: 'Description', render: (l: UnmatchedStatementLine) => l.description },
                    { header: 'Amount', align: 'right', render: (l: UnmatchedStatementLine) => String(l.amount) },
                    { header: 'Classification', render: (l: UnmatchedStatementLine) => l.classification.replace(/_/g, ' ') },
                  ]}
                  rows={summary.unmatchedStatementLines}
                  keyOf={(l) => l.id}
                  emptyMessage="No unmatched statement lines."
                />
              </div>
              <div>
                <PageHeader title="Unmatched book lines" />
                <DataTable
                  columns={[
                    { header: 'Date', render: (l: UnmatchedBookLine) => new Date(l.entryDate).toLocaleDateString() },
                    { header: 'Debit', align: 'right', render: (l: UnmatchedBookLine) => String(l.debit) },
                    { header: 'Credit', align: 'right', render: (l: UnmatchedBookLine) => String(l.credit) },
                    { header: 'Classification', render: (l: UnmatchedBookLine) => l.classification.replace(/_/g, ' ') },
                  ]}
                  rows={summary.unmatchedBookLines}
                  keyOf={(l) => l.id}
                  emptyMessage="No unmatched book lines."
                />
              </div>
            </div>
          </>
        )}
      </section>
    </PageContainer>
  );
}
