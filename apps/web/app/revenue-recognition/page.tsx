import { PageContainer, PageHeader, tokens } from '@7f/ui';
import type { SelectOption } from '@7f/ui';
import { fetchApi, ApiError } from '../../lib/api';
import { EntitySelector } from '../EntitySelector';
import { RecordCustomerPaymentForm } from './RecordCustomerPaymentForm';
import { RecognizeHandoverForm } from './RecognizeHandoverForm';

export const dynamic = 'force-dynamic';

interface Account {
  id: string;
  code: string;
  name: string;
}

/**
 * Frontend Completion, FE-3.5 — Revenue Recognition, fifth checkpoint
 * of Stage FE-3. See `actions.ts`'s own doc comment for why this page
 * is two command forms with no `DataTable` at all — the module simply
 * has no `GET` routes to list anything from.
 *
 * Chart of Accounts (`GET /accounts`) is fetched unconditionally, same
 * as `general-ledger/page.tsx`/`procurement/page.tsx` — every GL
 * account id field on both forms is a real `Select` sourced from it.
 * `EntitySelector` still renders on this page (for
 * `RecognizeHandoverForm`'s `entityId`), but `RecordCustomerPaymentForm`
 * renders unconditionally above it, regardless of whether an entity id
 * is present — it doesn't need one at all (see `actions.ts`'s own doc
 * comment).
 */
export default async function RevenueRecognitionPage({ searchParams }: { searchParams: { entityId?: string } }) {
  const entityId = searchParams.entityId;

  let accounts: Account[] | null = null;
  let accountsError: string | null = null;
  try {
    accounts = await fetchApi<Account[]>('/accounts?activeOnly=true');
  } catch (e) {
    accountsError = e instanceof ApiError ? e.message : 'Failed to load chart of accounts.';
  }
  const accountOptions: SelectOption[] = (accounts ?? []).map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }));

  return (
    <PageContainer>
      <PageHeader
        title="Revenue Recognition"
        subtitle="Deferred revenue on customer payments, and revenue recognition on unit handover (IFRS 15)."
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Revenue Recognition' }]}
      />

      {accountsError && (
        <div style={{ color: tokens.color.negative, fontFamily: tokens.font.body, marginBottom: tokens.space(4) }}>
          {accountsError}
        </div>
      )}

      <section style={{ marginBottom: tokens.space(8) }}>
        <PageHeader title="Record customer payment" subtitle="Posts to deferred revenue — the entity is derived from the installment line." />
        <RecordCustomerPaymentForm accountOptions={accountOptions} />
      </section>

      <section>
        <PageHeader title="Recognize revenue on handover" subtitle={entityId ? `Entity ${entityId}` : 'Enter an entity ID to recognize revenue on a unit handover.'} />
        <EntitySelector initialValue={entityId} />
        {entityId && <RecognizeHandoverForm entityId={entityId} accountOptions={accountOptions} />}
      </section>
    </PageContainer>
  );
}
